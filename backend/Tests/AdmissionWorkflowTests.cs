using System.Net;
using System.Net.Http.Json;
using Npgsql;
using Xunit;

namespace SchoolAdmissions.Tests;

public sealed class AdmissionWorkflowTests
{
    static readonly HttpClient FirstApi = Client("API_A", "http://localhost:8080");
    static readonly HttpClient SecondApi = Client("API_B", "http://localhost:8081");
    const string Student = "20152691234567890";
    static HttpClient Client(string key, string fallback) => new() { BaseAddress = new Uri(Environment.GetEnvironmentVariable(key) ?? fallback) };
    static async Task<ClassInfo> Create(int seats)
    {
        using var response = await FirstApi.PostAsJsonAsync("/classes", new CreateClass("Test class " + Guid.NewGuid(), seats));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ClassInfo>())!;
    }
    static async Task<HttpResponseMessage> Send(HttpClient client, string path, string student = Student, HttpMethod? method = null)
    {
        using var request = new HttpRequestMessage(method ?? HttpMethod.Post, path);
        request.Headers.Add("X-Student-Id", student);
        return await client.SendAsync(request);
    }
    static async Task<Application> Hold(ClassInfo category)
    {
        using var response = await Send(FirstApi, $"/classes/{category.Id}/holds");
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var hold = (await response.Content.ReadFromJsonAsync<Application>())!;
        Assert.Equal("HELD", hold.Status);
        return hold;
    }

    [Fact]
    public async Task ConfirmedAdmissionAppearsInHistoryAndStatistics()
    {
        var category = await Create(2);
        var hold = await Hold(category);
        using var paid = await Send(FirstApi, $"/holds/{hold.HoldId}/confirm");
        Assert.Equal("CONFIRMED", (await paid.Content.ReadFromJsonAsync<Application>())!.Status);
        var stats = await SecondApi.GetFromJsonAsync<ClassInfo>($"/classes/{category.Id}");
        Assert.Equal((0, 1, 1), (stats!.HeldSeats, stats.ConfirmedSeats, stats.AvailableSeats));
        using var history = await Send(SecondApi, "/me/holds", method: HttpMethod.Get);
        Assert.Contains((await history.Content.ReadFromJsonAsync<Application[]>())!, x => x.HoldId == hold.HoldId && x.Status == "CONFIRMED");
    }

    [Fact]
    public async Task DuplicateClassNamesKeepTheOriginalCapacity()
    {
        var grade = $"Class {Guid.NewGuid():N}";
        var day = new CreateClass($"{grade} - Day Shift", 110);
        var responses = await Task.WhenAll(FirstApi.PostAsJsonAsync("/classes", day), SecondApi.PostAsJsonAsync("/classes", day));
        try
        {
            Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Created);
            Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Conflict);
            using var duplicate = await SecondApi.PostAsJsonAsync("/classes", new CreateClass($"{grade}  – DAY shift", 999));
            Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
            var problem = await duplicate.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
            Assert.Equal($"{day.Name} already exists", problem.GetProperty("detail").GetString());
            using var morning = await FirstApi.PostAsJsonAsync("/classes", new CreateClass($"{grade} - Morning Shift", 120));
            Assert.Equal(HttpStatusCode.Created, morning.StatusCode);
            var classes = await SecondApi.GetFromJsonAsync<ClassInfo[]>("/classes");
            Assert.Equal(110, Assert.Single(classes!, category => category.Name == day.Name).TotalSeats);
        }
        finally { foreach (var response in responses) response.Dispose(); }
    }

    [Fact]
    public async Task ExpirationReleasesSeatWithoutAnApiCall()
    {
        var category = await Create(1);
        var hold = await Hold(category);
        var expiresAt = Assert.IsType<DateTime>(hold.ExpiresAt);
        await Task.Delay(expiresAt - DateTime.UtcNow + TimeSpan.FromSeconds(3));
        await using var connection = new NpgsqlConnection(Environment.GetEnvironmentVariable("TEST_DB"));
        await connection.OpenAsync();
        await using var query = new NpgsqlCommand("SELECT status FROM holds WHERE id=@id", connection);
        query.Parameters.AddWithValue("id", hold.HoldId);
        Assert.Equal("EXPIRED", await query.ExecuteScalarAsync());
        Assert.Equal(1, (await SecondApi.GetFromJsonAsync<ClassInfo>($"/classes/{category.Id}"))!.AvailableSeats);
        using var late = await Send(SecondApi, $"/holds/{hold.HoldId}/confirm");
        Assert.Equal(HttpStatusCode.Conflict, late.StatusCode);
        await Hold(category);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task LastSeatsCannotBeOversold(bool twoInstances)
    {
        var category = await Create(10);
        var responses = await Task.WhenAll(Enumerable.Range(0, 100).Select(i => Send(twoInstances && i % 2 == 1 ? SecondApi : FirstApi, $"/classes/{category.Id}/holds", i.ToString("D17"))));
        try
        {
            Assert.Equal(10, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
            Assert.Equal(90, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
            var stats = (await FirstApi.GetFromJsonAsync<ClassInfo>($"/classes/{category.Id}"))!;
            Assert.Equal((10, 0, 0), (stats.HeldSeats, stats.ConfirmedSeats, stats.AvailableSeats));
        }
        finally { foreach (var response in responses) response.Dispose(); }
    }

    [Fact]
    public async Task DuplicateHoldsAndRepeatedPayment()
    {
        var category = await Create(3);
        var hold = await Hold(category);
        using var duplicate = await Send(SecondApi, $"/classes/{category.Id}/holds");
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        var results = await Task.WhenAll(Send(FirstApi, $"/holds/{hold.HoldId}/confirm"), Send(SecondApi, $"/holds/{hold.HoldId}/confirm"));
        foreach (var r in results) { using (r) Assert.Equal(HttpStatusCode.OK, r.StatusCode); }
        Assert.Equal(1, (await FirstApi.GetFromJsonAsync<ClassInfo>($"/classes/{category.Id}"))!.ConfirmedSeats);
    }

    [Fact]
    public async Task OnlyOwnerCanPayOrCancel()
    {
        var category = await Create(1);
        var hold = await Hold(category);
        var url = $"/holds/{hold.HoldId}";
        using var denied = await Send(FirstApi, url, "00000000000000000", HttpMethod.Delete);
        using var payment = await Send(SecondApi, url + "/confirm", "00000000000000000");
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, payment.StatusCode);
        using var cancelled = await Send(SecondApi, url, method: HttpMethod.Delete);
        Assert.Equal(HttpStatusCode.NoContent, cancelled.StatusCode);
        using var details = await FirstApi.GetAsync(url);
        Assert.Contains("CANCELLED", await details.Content.ReadAsStringAsync());
        await Hold(category);
    }
}

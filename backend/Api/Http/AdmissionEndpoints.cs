using Microsoft.EntityFrameworkCore;

namespace SchoolAdmissions;

internal static class AdmissionEndpoints
{
    public static void MapAdmissionEndpoints(this WebApplication app)
    {
        app.MapGet("/health", async (AdmissionDb db) => await db.Database.CanConnectAsync() ? Results.Ok() : Results.StatusCode(503));

        app.MapPost("/classes", async (CreateClass input, Admissions service) =>
        {
            var category = await service.CreateClassAsync(input);
            return Results.Created($"/classes/{category.Id}", new { category.Id, category.Name, category.TotalSeats });
        });

        app.MapGet("/classes", (Admissions service) => service.Classes.OrderBy(category => category.Name).ThenBy(category => category.Id).ToListAsync());

        app.MapGet("/classes/{id}", async (string id, Admissions service) =>
            await service.Classes.SingleOrDefaultAsync(category => category.Id == id) ?? throw new AdmissionError(404, "Class not found."));

        app.MapPost("/classes/{id}/holds", async (string id, HttpRequest request, Admissions service) =>
        {
            var hold = await service.AllocateHoldAsync(id, ReadStudentId(request));
            return Results.Created($"/holds/{hold.HoldId}", new { hold.HoldId, hold.ClassId, hold.StudentId, hold.Status, hold.ExpiresAt });
        });

        app.MapGet("/holds/{id}", async (string id, Admissions service) =>
        {
            var hold = await service.History.SingleOrDefaultAsync(hold => hold.HoldId == id) ?? throw new AdmissionError(404, "Application not found.");
            return new { hold.HoldId, hold.ClassId, hold.Status, hold.ExpiresAt };
        });

        app.MapPost("/holds/{id}/confirm", async (string id, HttpRequest request, Admissions service) =>
        {
            var application = await service.TransitionHoldAsync(id, ReadStudentId(request), confirm: true);
            return Results.Ok(new { application.HoldId, application.Status });
        });

        app.MapDelete("/holds/{id}", async (string id, HttpRequest request, Admissions service) =>
        {
            await service.TransitionHoldAsync(id, ReadStudentId(request), confirm: false);
            return Results.NoContent();
        });

        app.MapGet("/me/holds", (HttpRequest request, Admissions service) =>
        {
            var id = ReadStudentId(request);
            return service.History.Where(hold => hold.StudentId == id)
                .OrderByDescending(hold => hold.CreatedAt)
                .Select(hold => new { hold.HoldId, hold.ClassId, hold.ClassName, hold.Status, hold.ExpiresAt })
                .ToListAsync();
        });
    }

    private static string ReadStudentId(HttpRequest request)
    {
        var id = request.Headers["X-Student-Id"].ToString();
        if (id.Length != 17 || !id.All(char.IsAsciiDigit))
            throw new AdmissionError(400, "Enter a 17-digit birth registration number.");
        return id;
    }
}

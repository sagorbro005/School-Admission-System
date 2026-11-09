using Microsoft.EntityFrameworkCore;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.AddFilter("Microsoft.EntityFrameworkCore.Database.Command", LogLevel.Warning);
builder.Logging.AddFilter("Microsoft.AspNetCore.Hosting.Diagnostics", LogLevel.Warning);
builder.Logging.AddFilter("Microsoft.AspNetCore.Routing.EndpointMiddleware", LogLevel.Warning);
builder.Logging.AddFilter("Microsoft.AspNetCore.Cors.Infrastructure.CorsService", LogLevel.Warning);
var connection = builder.Configuration.GetConnectionString("Admissions") ?? throw new InvalidOperationException("Set ConnectionStrings__Admissions.");
builder.Services.AddDbContext<AdmissionDb>(o => o.UseNpgsql(connection));
var seconds = builder.Configuration.GetValue<int?>("HOLD_DURATION_SECONDS") ?? 600;
if (seconds < 1) throw new InvalidOperationException("Hold duration must be positive.");
builder.Services.AddSingleton(new HoldPolicy(seconds));
builder.Services.AddScoped<Admissions>();
builder.Services.AddHostedService<ExpirationWorker>();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));
builder.Services.Configure<RouteHandlerOptions>(o => o.ThrowOnBadRequest = true);
var app = builder.Build();
using (var scope = app.Services.CreateScope())
{
    await scope.ServiceProvider.GetRequiredService<AdmissionDb>().MigrateSchema();
    app.Logger.LogInformation("Database migration complete. Admission API is ready.");
}
app.UseCors();
app.Use(async (context, next) =>
{
    try { await next(); }
    catch (Exception ex)
    {
        var (status, detail) = ex switch
        {
            AdmissionError e => (e.Status, e.Message),
            BadHttpRequestException e => (e.StatusCode, "Invalid request. Check the JSON fields and values."),
            PostgresException { SqlState: "23505" } => (409, "An active application already exists."),
            NpgsqlException e when e.IsTransient => (503, "Database is busy or unavailable. Please retry."),
            _ => (500, "The server could not complete the request.")
        };
        if (status >= 500) app.Logger.LogError(ex, "Request failed on {Path}", context.Request.Path);
        await Results.Problem(detail: detail, statusCode: status).ExecuteAsync(context);
    }
});
static string Student(HttpRequest request)
{
    var id = request.Headers["X-Student-Id"].ToString();
    if (id.Length != 17 || !id.All(char.IsAsciiDigit))
        throw new AdmissionError(400, "Enter a 17-digit birth registration number.");
    return id;
}
app.MapGet("/health", async (AdmissionDb db) => await db.Database.CanConnectAsync() ? Results.Ok() : Results.StatusCode(503));
app.MapPost("/classes", async (CreateClass input, Admissions service) =>
{
    var c = await service.Create(input);
    return Results.Created($"/classes/{c.Id}", new { c.Id, c.Name, c.TotalSeats });
});
app.MapGet("/classes", (Admissions s) => s.Classes.OrderBy(c => c.Name).ThenBy(c => c.Id).ToListAsync());
app.MapGet("/classes/{id}", async (string id, Admissions s) =>
    await s.Classes.SingleOrDefaultAsync(c => c.Id == id) ?? throw new AdmissionError(404, "Class not found."));
app.MapPost("/classes/{id}/holds", async (string id, HttpRequest r, Admissions s) =>
{
    var h = await s.Hold(id, Student(r));
    return Results.Created($"/holds/{h.HoldId}", new { h.HoldId, h.ClassId, h.StudentId, h.Status, h.ExpiresAt });
});
app.MapGet("/holds/{id}", async (string id, Admissions s) =>
{
    var h = await s.History.SingleOrDefaultAsync(h => h.HoldId == id) ?? throw new AdmissionError(404, "Application not found.");
    return new { h.HoldId, h.ClassId, h.Status, h.ExpiresAt };
});
app.MapPost("/holds/{id}/confirm", async (string id, HttpRequest r, Admissions s) =>
{
    var a = await s.Transition(id, Student(r), true);
    return Results.Ok(new { a.HoldId, a.Status });
});
app.MapDelete("/holds/{id}", async (string id, HttpRequest r, Admissions s) =>
{
    await s.Transition(id, Student(r), false);
    return Results.NoContent();
});
app.MapGet("/me/holds", (HttpRequest r, Admissions s) =>
{
    var id = Student(r);
    return s.History.Where(h => h.StudentId == id)
        .OrderByDescending(h => h.CreatedAt)
        .Select(h => new { h.HoldId, h.ClassId, h.ClassName, h.Status, h.ExpiresAt })
        .ToListAsync();
});
app.Run();

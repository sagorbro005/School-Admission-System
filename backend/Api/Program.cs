using Microsoft.EntityFrameworkCore;
using SchoolAdmissions;

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
app.UseMiddleware<ApiErrorHandler>();
app.MapAdmissionEndpoints();
app.Run();

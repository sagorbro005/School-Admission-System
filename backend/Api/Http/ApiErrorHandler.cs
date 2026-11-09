using Npgsql;

namespace SchoolAdmissions;

internal sealed class ApiErrorHandler(RequestDelegate next, ILogger<ApiErrorHandler> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try { await next(context); }
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
            if (status >= 500) logger.LogError(ex, "Request failed on {Path}", context.Request.Path);
            await Results.Problem(detail: detail, statusCode: status).ExecuteAsync(context);
        }
    }
}

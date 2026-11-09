using Microsoft.EntityFrameworkCore;

namespace SchoolAdmissions;

public sealed class ExpirationWorker(IServiceScopeFactory scopes, ILogger<ExpirationWorker> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        while (!stop.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AdmissionDb>();
                await db.Database.ExecuteSqlRawAsync("""
                    UPDATE holds SET status='EXPIRED' WHERE id IN (
                      SELECT id FROM holds WHERE status='HELD' AND expires_at <= statement_timestamp()
                      ORDER BY expires_at LIMIT 500 FOR UPDATE SKIP LOCKED)
                    """, stop);
            }
            catch (Exception e) when (!stop.IsCancellationRequested) { log.LogError(e, "Hold expiration sweep failed"); }
            await Task.Delay(TimeSpan.FromSeconds(1), stop);
        }
    }
}

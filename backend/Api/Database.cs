using Microsoft.EntityFrameworkCore;

public sealed class AdmissionDb(DbContextOptions<AdmissionDb> options) : DbContext(options)
{
    public async Task MigrateSchema()
    {
        await using var tx = await Database.BeginTransactionAsync();
        await Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(39850618)");
        await Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS schema_versions (version text PRIMARY KEY)");
        var assembly = typeof(AdmissionDb).Assembly;
        foreach (var name in assembly.GetManifestResourceNames().Where(x => x.EndsWith(".sql")).Order())
        {
            if (await Database.SqlQuery<int>($"SELECT 1 AS \"Value\" FROM schema_versions WHERE version={name}").AnyAsync()) continue;
            using var reader = new StreamReader(assembly.GetManifestResourceStream(name)!);
            await Database.ExecuteSqlRawAsync(await reader.ReadToEndAsync());
            await Database.ExecuteSqlInterpolatedAsync($"INSERT INTO schema_versions VALUES ({name})");
        }
        await tx.CommitAsync();
    }
}

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

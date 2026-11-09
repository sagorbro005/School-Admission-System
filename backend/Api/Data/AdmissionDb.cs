using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace SchoolAdmissions;

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
            await using var command = Database.GetDbConnection().CreateCommand();
            command.Transaction = tx.GetDbTransaction();
            command.CommandText = await reader.ReadToEndAsync();
            await command.ExecuteNonQueryAsync();
            await Database.ExecuteSqlInterpolatedAsync($"INSERT INTO schema_versions VALUES ({name})");
        }
        await tx.CommitAsync();
    }
}

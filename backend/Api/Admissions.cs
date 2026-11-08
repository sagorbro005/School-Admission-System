using Microsoft.EntityFrameworkCore;

public record CreateClass(string? Name, int TotalSeats);
public record ClassInfo(string Id, string Name, int TotalSeats, int HeldSeats, int ConfirmedSeats, int AvailableSeats);
public record Application(string HoldId, string ClassId, string ClassName, string StudentId, string Status, DateTime ExpiresAt, DateTime CreatedAt);
public sealed class AdmissionError(int status, string message) : Exception(message) { public int Status => status; }
public record HoldPolicy(int Seconds);

public sealed class Admissions(AdmissionDb db, HoldPolicy policy)
{
    public IQueryable<ClassInfo> Classes => db.Database.SqlQueryRaw<ClassInfo>("SELECT * FROM class_statistics");
    public IQueryable<Application> History => db.Database.SqlQueryRaw<Application>("SELECT * FROM application_history");
    public async Task<ClassInfo> Create(CreateClass input)
    {
        var name = input.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name) || name.Length > 160 || name.Contains('\0') || input.TotalSeats <= 0)
            throw new AdmissionError(400, "Enter a class name of 1–160 characters and a positive seat capacity.");
        var id = $"c_{Guid.NewGuid():N}";
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO classes(id,name,total_seats) VALUES ({id},{name},{input.TotalSeats})");
        return await Classes.SingleAsync(x => x.Id == id);
    }

    public async Task<Application> Hold(string classId, string student)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        // Take the class lock in its own statement. READ COMMITTED gives the following
        // capacity query a fresh snapshot after waiting for the previous allocator.
        var capacity = await db.Database.SqlQuery<int>($"SELECT total_seats AS \"Value\" FROM classes WHERE id={classId} FOR UPDATE").ToListAsync();
        if (capacity.Count == 0) throw new AdmissionError(404, "Class not found.");
        await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE holds SET status='EXPIRED' WHERE class_id={classId} AND status='HELD' AND expires_at <= statement_timestamp()");
        if (await History.AnyAsync(h => h.ClassId == classId && h.StudentId == student && (h.Status == "HELD" || h.Status == "CONFIRMED")))
            throw new AdmissionError(409, "You already have an active application for this class.");
        if (await Classes.Where(c => c.Id == classId).Select(c => c.AvailableSeats).SingleAsync() == 0)
            throw new AdmissionError(409, "No seats are available in this class.");
        var id = $"h_{Guid.NewGuid():N}";
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO holds(id,class_id,student_id,status,expires_at)
            VALUES ({id},{classId},{student},'HELD',statement_timestamp() + make_interval(secs => {policy.Seconds}))
            """);
        var result = await History.SingleAsync(h => h.HoldId == id);
        await tx.CommitAsync();
        return result;
    }

    public async Task<Application> Transition(string id, string student, bool confirm)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        var locked = await db.Database.SqlQuery<string>($"SELECT student_id AS \"Value\" FROM holds WHERE id={id} FOR UPDATE").ToListAsync();
        if (locked.Count == 0) throw new AdmissionError(404, "Application not found.");
        if (locked[0] != student) throw new AdmissionError(403, "This application belongs to another student.");
        var target = confirm ? "CONFIRMED" : "CANCELLED";
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            UPDATE holds SET status={target},
              confirmed_at=CASE WHEN {confirm} THEN statement_timestamp() END,
              cancelled_at=CASE WHEN {confirm} THEN NULL ELSE statement_timestamp() END
            WHERE id={id} AND status='HELD' AND expires_at > statement_timestamp()
            """);
        var result = await History.SingleAsync(h => h.HoldId == id);
        if (result.Status != target) throw new AdmissionError(409, $"This application is {result.Status.ToLowerInvariant()}.");
        await tx.CommitAsync();
        return result;
    }
}

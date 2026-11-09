namespace SchoolAdmissions;

public record CreateClass(string? Name, int TotalSeats);
public record ClassInfo(string Id, string Name, int TotalSeats, int HeldSeats = 0, int ConfirmedSeats = 0, int AvailableSeats = 0);
public record Application(
    string HoldId,
    string Status,
    string? ClassId = null,
    string? ClassName = null,
    string? StudentId = null,
    DateTime? ExpiresAt = null,
    DateTime? CreatedAt = null);
public sealed class AdmissionError(int status, string message) : Exception(message) { public int Status => status; }
public record HoldPolicy(int Seconds);

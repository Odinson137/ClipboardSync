namespace ClipboardSync.Server.Models;

public abstract class BaseModel
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
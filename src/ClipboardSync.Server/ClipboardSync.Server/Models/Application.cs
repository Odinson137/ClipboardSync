namespace ClipboardSync.Server.Models;

public class Application : BaseModel
{
    public string Name { get; set; } = string.Empty;
    
    public Guid UserId { get; set; }
}
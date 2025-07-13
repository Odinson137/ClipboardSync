using ClipboardSync.Api.Data.Enums;

namespace ClipboardSync.Api.Models;

public class Command : BaseModel
{
    public Guid UserId { get; set; }
    
    public Guid ApplicationId { get; set; }
    
    public string Payload { get; set; } = string.Empty;
    
    public CommandType Type { get; set; }
}
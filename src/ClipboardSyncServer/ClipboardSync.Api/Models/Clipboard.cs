using ClipboardSync.Api.Data.Enums;

namespace ClipboardSync.Api.Models;

public class Clipboard : BaseModel
{
    public Guid UserId { get; set; }
    
    public string Content { get; set; } = string.Empty;
    
    public ClipboardType Type { get; set; }
    
    public Guid ClipboardCreatorId { get; set; }
}
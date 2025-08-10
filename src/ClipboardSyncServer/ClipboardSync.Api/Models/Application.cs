using ClipboardSync.Api.Data.Enums;

namespace ClipboardSync.Api.Models;

public class Application : BaseModel
{
    public string Name { get; set; } = string.Empty;

    public Guid UserId { get; set; }
    
    public ConnectionState ConnectionState { get; set; }
    
    public ApplicationType ApplicationType { get; set; }
    
    public string DeviceIdentifier { get; set; } = string.Empty;
}
namespace ClipboardSync.Api.Models;

public class User : BaseModel
{
    public string UserName { get; set; } = string.Empty;
    
    public string Email { get; set; } = string.Empty;
    
    public string Password { get; set; } = string.Empty;
    
    public string Salt { get; set; } = string.Empty;
}
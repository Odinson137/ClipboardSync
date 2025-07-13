using Microsoft.AspNetCore.SignalR;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
var services = builder.Services;
services.AddSignalR();
services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policyBuilder =>
    {
        policyBuilder.AllowAnyOrigin()
               .AllowAnyMethod()
               .AllowAnyHeader();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
app.UseCors("AllowAll");
app.MapHub<ClipboardHub>("/clipboardHub");

app.Run();

public class ClipboardHub : Hub
{
    private static readonly Dictionary<string, string> Users = new();

    public async Task Authenticate(string username, string password)
    {
        if (password == "secret") 
        {
            Users[Context.ConnectionId] = username;
            await Clients.Caller.SendAsync("AuthSuccess", $"Welcome, {username}!");
        }
        else
        {
            await Clients.Caller.SendAsync("AuthFailed", "Invalid credentials.");
        }
    }

    public async Task SendClipboard(string userId, string text)
    {
        if (Users.ContainsKey(Context.ConnectionId))
        {
            await Clients.AllExcept(Context.ConnectionId).SendAsync("ReceiveClipboard", text);
            await Clients.Caller.SendAsync("ClipboardSent", "Clipboard data sent successfully.");
        }
        else
        {
            await Clients.Caller.SendAsync("Unauthorized", "Please authenticate first.");
        }
    }

    public async Task EnableHotspot(string userId)
    {
        if (Users.ContainsKey(Context.ConnectionId))
        {
            await Clients.Caller.SendAsync("HotspotCommand", "enable");
            await Clients.Caller.SendAsync("HotspotResponse", "Hotspot enable command sent.");
        }
        else
        {
            await Clients.Caller.SendAsync("Unauthorized", "Please authenticate first.");
        }
    }

    public async Task DisableHotspot(string userId)
    {
        if (Users.ContainsKey(Context.ConnectionId))
        {
            await Clients.Caller.SendAsync("HotspotCommand", "disable");
            await Clients.Caller.SendAsync("HotspotResponse", "Hotspot disable command sent.");
        }
        else
        {
            await Clients.Caller.SendAsync("Unauthorized", "Please authenticate first.");
        }
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        if (Users.ContainsKey(Context.ConnectionId))
        {
            Users.Remove(Context.ConnectionId);
        }
        return base.OnDisconnectedAsync(exception);
    }
}
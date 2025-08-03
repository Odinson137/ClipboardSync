using ClipboardSync.Api.Data.Enums;
using ClipboardSync.Api.Interfaces;
using ClipboardSync.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace ClipboardSync.Api.Hubs;

[Authorize]
public class ClipboardSyncHub : Hub
{
    private readonly ILogger<ClipboardSyncHub> _logger;
    private readonly IUserRepository _userRepository;
    private readonly IApplicationRepository _applicationRepository;
    private readonly IClipboardRepository _clipboardRepository;
    private readonly ICommandRepository _commandRepository;

    public ClipboardSyncHub(
        IUserRepository userRepository,
        IApplicationRepository applicationRepository,
        IClipboardRepository clipboardRepository,
        ICommandRepository commandRepository, ILogger<ClipboardSyncHub> logger)
    {
        _userRepository = userRepository;
        _applicationRepository = applicationRepository;
        _clipboardRepository = clipboardRepository;
        _commandRepository = commandRepository;
        _logger = logger;
    }

    public async Task RegisterDevice(string deviceName)
    {
        var userId = Guid.Parse(Context.UserIdentifier); // Получаем userId из токена
        _logger.LogInformation($"Registering device {deviceName} for user {userId}");
        
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
        {
            throw new HubException("User not found.");
        }

        var application = new Application
        {
            UserId = userId,
            Name = deviceName,
            ConnectionState = ConnectionState.Active,
            CreatedAt = DateTime.UtcNow
        };
        await _applicationRepository.CreateAsync(application);

        await Groups.AddToGroupAsync(Context.ConnectionId, userId.ToString());
        await Clients.Group(userId.ToString()).SendAsync("DeviceConnected", application.Id, deviceName);
    }

    public async Task SendClipboard(string content, ClipboardType type)
    {
        var userId = Guid.Parse(Context.UserIdentifier);
        _logger.LogInformation($"Sending clipboard to user {userId}");

        var clipboard = new Clipboard
        {
            UserId = userId,
            Content = content,
            Type = type
        };
        await _clipboardRepository.CreateAsync(clipboard);

        await Clients.Group(userId.ToString()).SendAsync("ReceiveClipboard", clipboard.Id, content, type);
    }

    public async Task SendCommand(Guid applicationId, CommandType type)
    {
        var userId = Guid.Parse(Context.UserIdentifier);
        _logger.LogInformation($"Sending command to user {userId}");

        var command = new Command
        {
            UserId = userId,
            ApplicationId = applicationId,
            Type = type,
            CreatedAt = DateTime.UtcNow
        };
        await _commandRepository.CreateAsync(command);

        await Clients.Group(userId.ToString()).SendAsync("ReceiveCommand", command.Id, applicationId, type);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation($"Disconnected from user {Context.ConnectionId}", exception?.Message);
        await Clients.Group(Context.UserIdentifier ?? "").SendAsync("DeviceDisconnected", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
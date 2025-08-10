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

    public override async Task OnConnectedAsync()
    {
        var userId = Guid.Parse(Context.UserIdentifier!);
        var httpRequest = Context.GetHttpContext()?.Request;
        var deviceName = httpRequest?.Query["deviceName"].ToString();
        var deviceTypeStr = httpRequest?.Query["applicationType"].ToString();
        var deviceIdentifier = httpRequest?.Query["deviceIdentifier"].ToString();

        _logger.LogInformation($"Device connected: {deviceName} ({deviceIdentifier}) by user {userId}");

        if (string.IsNullOrWhiteSpace(deviceName) || string.IsNullOrWhiteSpace(deviceTypeStr) ||
            string.IsNullOrWhiteSpace(deviceIdentifier))
        {
            throw new HubException("Missing connection parameters.");
        }

        if (!Enum.TryParse<ApplicationType>(deviceTypeStr, true, out var applicationType))
        {
            throw new HubException("Invalid application type.");
        }

        // Проверяем наличие устройства по UserId и DeviceIdentifier
        var existingApplication =
            await _applicationRepository.GetByUserIdAndDeviceIdentifierAsync(userId, deviceIdentifier);

        Guid applicationId;

        if (existingApplication != null)
        {
            existingApplication.ConnectionState = ConnectionState.Active;
            existingApplication.Name = deviceName; // Можно обновлять имя, если нужно
            existingApplication.ApplicationType = applicationType;
            await _applicationRepository.UpdateAsync(existingApplication);
            applicationId = existingApplication.Id;
        }
        else
        {
            var application = new Application
            {
                UserId = userId,
                Name = deviceName,
                ConnectionState = ConnectionState.Active,
                ApplicationType = applicationType,
                DeviceIdentifier = deviceIdentifier,
                CreatedAt = DateTime.UtcNow
            };

            await _applicationRepository.CreateAsync(application);
            applicationId = application.Id;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, userId.ToString());

        await Clients.Group(userId.ToString()).SendAsync("DeviceConnected", applicationId, deviceName);

        await base.OnConnectedAsync();
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

        await Clients.GroupExcept(userId.ToString(), Context.ConnectionId)
            .SendAsync("ReceiveClipboard", clipboard.Id, content, type);
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
        var userId = Guid.Parse(Context.UserIdentifier!);
        var deviceIdentifier = Context.GetHttpContext()?.Request.Query["deviceIdentifier"].ToString();

        _logger.LogInformation($"Disconnected device {deviceIdentifier} from user {userId}. ConnectionId: {Context.ConnectionId}");

        if (!string.IsNullOrWhiteSpace(deviceIdentifier))
        {
            var application = await _applicationRepository.GetByUserIdAndDeviceIdentifierAsync(userId, deviceIdentifier);
            if (application != null)
            {
                application.ConnectionState = ConnectionState.Disconnected;
                await _applicationRepository.UpdateAsync(application);
            }
        }

        await Clients.Group(userId.ToString()).SendAsync("DeviceDisconnected", deviceIdentifier);

        await base.OnDisconnectedAsync(exception);
    }
}
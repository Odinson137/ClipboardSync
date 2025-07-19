using ClipboardSync.Api.Data.Enums;
using ClipboardSync.Api.Interfaces;
using ClipboardSync.Api.Models;
using Microsoft.AspNetCore.SignalR;

namespace ClipboardSync.Api.Hubs;

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

    public async Task RegisterDevice(Guid userId, string deviceName)
    {
        _logger.LogInformation($"Registering device {deviceName}", deviceName);
        // Проверяем, существует ли пользователь
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
        {
            throw new HubException("User not found.");
        }

        // Создаем или обновляем приложение
        var application = new Application
        {
            UserId = userId,
            Name = deviceName,
            ConnectionState = ConnectionState.Active,
            CreatedAt = DateTime.UtcNow
        };
        await _applicationRepository.CreateAsync(application);

        // Добавляем устройство в группу по UserId
        await Groups.AddToGroupAsync(Context.ConnectionId, userId.ToString());

        // Уведомляем другие устройства пользователя
        await Clients.Group(userId.ToString()).SendAsync("DeviceConnected", application.Id, deviceName);
    }

    public async Task SendClipboard(Guid userId, string content, ClipboardType type)
    {
        _logger.LogInformation($"Sending clipboard to user {userId}", userId);
        var clipboard = new Clipboard
        {
            UserId = userId,
            Content = content,
            Type = type
        };
        await _clipboardRepository.CreateAsync(clipboard);

        // Отправляем буфер обмена всем устройствам пользователя
        await Clients.Group(userId.ToString()).SendAsync("ReceiveClipboard", clipboard.Id, content, type);
    }

    public async Task SendCommand(Guid userId, Guid applicationId, CommandType type)
    {
        _logger.LogInformation($"Sending command to user {userId}", userId);
        var command = new Command
        {
            UserId = userId,
            ApplicationId = applicationId,
            Type = type,
            CreatedAt = DateTime.UtcNow
        };
        await _commandRepository.CreateAsync(command);

        // Отправляем команду конкретному устройству
        await Clients.Group(userId.ToString()).SendAsync("ReceiveCommand", command.Id, applicationId, type);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation($"Disconnected from user {Context.ConnectionId}", exception?.Message);
        // Найти приложение по ConnectionId (нужен дополнительный индекс в Redis, если храните ConnectionId)
        // Для простоты предполагаем, что устройство будет помечено как Disconnected
        await Clients.Group(Context.UserIdentifier ?? "").SendAsync("DeviceDisconnected", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
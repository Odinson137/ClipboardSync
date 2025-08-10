using ClipboardSync.Api.Data.Enums;
using ClipboardSync.Api.Interfaces;
using ClipboardSync.Api.Models;
using StackExchange.Redis;

namespace ClipboardSync.Api.Repositories;

public class ApplicationRepository(IConnectionMultiplexer redis) : IApplicationRepository
{
    private readonly IDatabase _db = redis.GetDatabase();

    private static string GetAppKey(Guid id) => $"application:{id}";
    private static string GetIndexKey(Guid userId, string deviceIdentifier) =>
        $"application:index:{userId}:{deviceIdentifier}";

    public async Task<Application> CreateAsync(Application application)
    {
        application.Id = application.Id == Guid.Empty ? Guid.NewGuid() : application.Id;

        var hashEntries = new[]
        {
            new HashEntry("Id", application.Id.ToString()),
            new HashEntry("Name", application.Name),
            new HashEntry("UserId", application.UserId.ToString()),
            new HashEntry("ConnectionState", ((int)application.ConnectionState).ToString()),
            new HashEntry("ApplicationType", ((int)application.ApplicationType).ToString()),
            new HashEntry("DeviceIdentifier", application.DeviceIdentifier),
            new HashEntry("CreatedAt", application.CreatedAt.ToString("O"))
        };

        await _db.HashSetAsync(GetAppKey(application.Id), hashEntries);

        // Сохраняем индекс по (UserId, DeviceIdentifier)
        await _db.StringSetAsync(GetIndexKey(application.UserId, application.DeviceIdentifier), application.Id.ToString());

        return application;
    }

    public async Task<Application?> GetByIdAsync(Guid id)
    {
        var hash = await _db.HashGetAllAsync(GetAppKey(id));
        if (hash.Length == 0) return null;

        return MapFromHash(hash);
    }

    public async Task<Application?> GetByUserIdAndDeviceIdentifierAsync(Guid userId, string deviceIdentifier)
    {
        var indexKey = GetIndexKey(userId, deviceIdentifier);
        var appIdStr = await _db.StringGetAsync(indexKey);

        if (appIdStr.IsNullOrEmpty) return null;

        if (!Guid.TryParse(appIdStr!, out var appId))
            return null;

        return await GetByIdAsync(appId);
    }

    public async Task UpdateAsync(Application application)
    {
        var exists = await _db.KeyExistsAsync(GetAppKey(application.Id));
        if (!exists)
            throw new Exception($"Application with ID {application.Id} does not exist");

        var hashEntries = new[]
        {
            new HashEntry("Name", application.Name),
            new HashEntry("ConnectionState", ((int)application.ConnectionState).ToString()),
            new HashEntry("ApplicationType", ((int)application.ApplicationType).ToString()),
            new HashEntry("DeviceIdentifier", application.DeviceIdentifier)
        };

        await _db.HashSetAsync(GetAppKey(application.Id), hashEntries);
    }

    public async Task DeleteAsync(Guid id)
    {
        var app = await GetByIdAsync(id);
        if (app != null)
        {
            await _db.KeyDeleteAsync(GetAppKey(id));
            await _db.KeyDeleteAsync(GetIndexKey(app.UserId, app.DeviceIdentifier));
        }
    }

    private static Application MapFromHash(HashEntry[] hash)
    {
        var dict = hash.ToDictionary(h => h.Name.ToString(), h => h.Value.ToString());

        return new Application
        {
            Id = Guid.Parse(dict["Id"]),
            Name = dict["Name"],
            UserId = Guid.Parse(dict["UserId"]),
            ConnectionState = (ConnectionState)int.Parse(dict["ConnectionState"]),
            ApplicationType = dict.ContainsKey("ApplicationType") 
                ? (ApplicationType)int.Parse(dict["ApplicationType"]) 
                : ApplicationType.Desktop, // fallback
            DeviceIdentifier = dict.ContainsKey("DeviceIdentifier") 
                ? dict["DeviceIdentifier"] 
                : string.Empty,
            CreatedAt = DateTime.Parse(dict["CreatedAt"])
        };
    }
}

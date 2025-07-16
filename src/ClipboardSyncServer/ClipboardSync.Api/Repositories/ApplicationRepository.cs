using ClipboardSync.Api.Data.Enums;
using ClipboardSync.Api.Interfaces;
using ClipboardSync.Api.Models;
using StackExchange.Redis;

namespace ClipboardSync.Api.Repositories;

public class ApplicationRepository(IConnectionMultiplexer redis) : IApplicationRepository
{
    private readonly IDatabase _db = redis.GetDatabase();

    public async Task<Application> CreateAsync(Application application)
    {
        var hashEntries = new[]
        {
            new HashEntry("Name", application.Name),
            new HashEntry("UserId", application.UserId.ToString()),
            new HashEntry("ConnectionState", ((int)application.ConnectionState).ToString()),
            new HashEntry("Id", application.Id.ToString()),
            new HashEntry("CreatedAt", application.CreatedAt.ToString("O"))
        };
        await _db.HashSetAsync($"application:{application.Id}", hashEntries);
        return application;
    }

    public async Task<Application?> GetByIdAsync(Guid id)
    {
        var hash = await _db.HashGetAllAsync($"application:{id}");
        if (hash.Length == 0) return null;

        return new Application
        {
            Id = Guid.Parse(hash.First(h => h.Name == "Id").Value!),
            Name = hash.First(h => h.Name == "Name").Value!,
            UserId = Guid.Parse(hash.First(h => h.Name == "UserId").Value!),
            ConnectionState = (ConnectionState)int.Parse(hash.First(h => h.Name == "ConnectionState").Value!),
            CreatedAt = DateTime.Parse(hash.First(h => h.Name == "CreatedAt").Value!)
        };
    }

    public async Task DeleteAsync(Guid id)
    {
        await _db.KeyDeleteAsync($"application:{id}");
    }
}
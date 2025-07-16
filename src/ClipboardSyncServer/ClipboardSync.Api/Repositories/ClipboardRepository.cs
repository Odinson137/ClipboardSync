using ClipboardSync.Api.Data.Enums;
using ClipboardSync.Api.Interfaces;
using ClipboardSync.Api.Models;
using StackExchange.Redis;

namespace ClipboardSync.Api.Repositories;

public class ClipboardRepository(IConnectionMultiplexer redis) : IClipboardRepository
{
    private readonly IDatabase _db = redis.GetDatabase();

    public async Task<Clipboard> CreateAsync(Clipboard clipboard)
    {
        var hashEntries = new[]
        {
            new HashEntry("UserId", clipboard.UserId.ToString()),
            new HashEntry("Content", clipboard.Content),
            new HashEntry("Type", ((int)clipboard.Type).ToString()),
            new HashEntry("Id", clipboard.Id.ToString()),
            new HashEntry("CreatedAt", clipboard.CreatedAt.ToString("O"))
        };
        await _db.HashSetAsync($"clipboard:{clipboard.Id}", hashEntries);
        return clipboard;
    }

    public async Task<Clipboard?> GetByIdAsync(Guid id)
    {
        var hash = await _db.HashGetAllAsync($"clipboard:{id}");
        if (hash.Length == 0) return null;

        return new Clipboard
        {
            Id = Guid.Parse(hash.First(h => h.Name == "Id").Value!),
            UserId = Guid.Parse(hash.First(h => h.Name == "UserId").Value!),
            Content = hash.First(h => h.Name == "Content").Value!,
            Type = (ClipboardType)int.Parse(hash.First(h => h.Name == "Type").Value!),
            CreatedAt = DateTime.Parse(hash.First(h => h.Name == "CreatedAt").Value!)
        };
    }

    public async Task DeleteAsync(Guid id)
    {
        await _db.KeyDeleteAsync($"clipboard:{id}");
    }
}
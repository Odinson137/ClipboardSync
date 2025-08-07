using ClipboardSync.Api.Data.Enums;
using ClipboardSync.Api.Interfaces;
using ClipboardSync.Api.Models;
using StackExchange.Redis;
using System.Collections.Concurrent;

namespace ClipboardSync.Api.Repositories;

public class ClipboardRepository(IConnectionMultiplexer redis) : IClipboardRepository
{
    private readonly IDatabase _db = redis.GetDatabase();
    private static readonly TimeSpan ExpirationTime = TimeSpan.FromHours(24);

    public async Task<Clipboard> CreateAsync(Clipboard clipboard)
    {
        var key = $"clipboard:{clipboard.Id}";
        var userIndexKey = $"userclip:{clipboard.UserId}";

        var hashEntries = new[]
        {
            new HashEntry("UserId", clipboard.UserId.ToString()),
            new HashEntry("Content", clipboard.Content ?? ""),
            new HashEntry("Type", ((int)clipboard.Type).ToString()),
            new HashEntry("Id", clipboard.Id.ToString()),
            new HashEntry("CreatedAt", clipboard.CreatedAt.ToString("O"))
        };

        // Используем транзакцию для атомарности
        var transaction = _db.CreateTransaction();
        await transaction.HashSetAsync(key, hashEntries, CommandFlags.FireAndForget);
        await transaction.KeyExpireAsync(key, ExpirationTime, CommandFlags.FireAndForget);
        await transaction.SortedSetAddAsync(userIndexKey, clipboard.Id.ToString(), clipboard.CreatedAt.Ticks, CommandFlags.FireAndForget);
        await transaction.KeyExpireAsync(userIndexKey, ExpirationTime, CommandFlags.FireAndForget); // Обновляем TTL индекса

        await transaction.ExecuteAsync();

        return clipboard;
    }

    public async Task<Clipboard?> GetByIdAsync(Guid id)
    {
        var hash = await _db.HashGetAllAsync($"clipboard:{id}");
        return hash.Length == 0 ? null : MapToClipboard(hash);
    }

    public async Task DeleteAsync(Guid id)
    {
        var key = $"clipboard:{id}";

        // Получаем UserId, чтобы удалить ID из индекса
        var hash = await _db.HashGetAllAsync(key);
        if (hash.Length == 0) return;

        var userId = hash.FirstOrDefault(h => h.Name == "UserId").Value;
        if (!Guid.TryParse(userId, out var parsedUserId)) return;

        var userIndexKey = $"userclip:{parsedUserId}";

        // Удаляем и из данных, и из индекса
        var transaction = _db.CreateTransaction();
        await transaction.KeyDeleteAsync(key, CommandFlags.FireAndForget);
        await transaction.SortedSetRemoveAsync(userIndexKey, id.ToString(), CommandFlags.FireAndForget);

        await transaction.ExecuteAsync();
    }

    public async Task<IEnumerable<Clipboard>> GetByUserIdAsync(Guid userId)
    {
        var userIndexKey = $"userclip:{userId}";

        // Получаем ID в порядке убывания времени (свежие — первыми)
        var idMembers = await _db.SortedSetRangeByRankAsync(userIndexKey, order: Order.Descending);
        if (idMembers.Length == 0) return [];

        // Параллельно загружаем объекты
        var tasks = idMembers.Select(async idBytes =>
        {
            var id = idBytes.ToString();
            if (string.IsNullOrEmpty(id)) return null;

            var hash = await _db.HashGetAllAsync($"clipboard:{Guid.Parse(id)}");
            return hash.Length == 0 ? null : MapToClipboard(hash);
        });

        var results = await Task.WhenAll(tasks);
        return results.Where(x => x is not null)!;
    }

    // Вспомогательный метод для маппинга
    private static Clipboard? MapToClipboard(HashEntry[] hash)
    {
        try
        {
            return new Clipboard
            {
                Id = Guid.Parse(GetValue(hash, "Id")),
                UserId = Guid.Parse(GetValue(hash, "UserId")),
                Content = GetValue(hash, "Content"),
                Type = Enum.IsDefined(typeof(ClipboardType), int.Parse(GetValue(hash, "Type")))
                    ? (ClipboardType)int.Parse(GetValue(hash, "Type"))
                    : ClipboardType.Text,
                CreatedAt = DateTime.Parse(GetValue(hash, "CreatedAt"))
            };
        }
        catch
        {
            return null; // На случай повреждённых данных
        }
    }

    private static string GetValue(HashEntry[] hash, string name)
    {
        var value = hash.FirstOrDefault(h => h.Name == name);
        return value.Value.HasValue ? value.Value! : string.Empty;
    }
}
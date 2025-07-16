using ClipboardSync.Api.Data.Enums;
using ClipboardSync.Api.Interfaces;
using ClipboardSync.Api.Models;
using StackExchange.Redis;

namespace ClipboardSync.Api.Repositories;

public class CommandRepository(IConnectionMultiplexer redis) : ICommandRepository
{
    private readonly IDatabase _db = redis.GetDatabase();

    public async Task<Command> CreateAsync(Command command)
    {
        var hashEntries = new[]
        {
            new HashEntry("UserId", command.UserId.ToString()),
            new HashEntry("ApplicationId", command.ApplicationId.ToString()),
            new HashEntry("Type", ((int)command.Type).ToString()),
            new HashEntry("Id", command.Id.ToString()),
            new HashEntry("CreatedAt", command.CreatedAt.ToString("O"))
        };
        await _db.HashSetAsync($"command:{command.Id}", hashEntries);
        return command;
    }

    public async Task<Command?> GetByIdAsync(Guid id)
    {
        var hash = await _db.HashGetAllAsync($"command:{id}");
        if (hash.Length == 0) return null;

        return new Command
        {
            Id = Guid.Parse(hash.First(h => h.Name == "Id").Value!),
            UserId = Guid.Parse(hash.First(h => h.Name == "UserId").Value!),
            ApplicationId = Guid.Parse(hash.First(h => h.Name == "ApplicationId").Value!),
            Type = (CommandType)int.Parse(hash.First(h => h.Name == "Type").Value!),
            CreatedAt = DateTime.Parse(hash.First(h => h.Name == "CreatedAt").Value!)
        };
    }

    public async Task DeleteAsync(Guid id)
    {
        await _db.KeyDeleteAsync($"command:{id}");
    }
}
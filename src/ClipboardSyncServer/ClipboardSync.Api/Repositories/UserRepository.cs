using ClipboardSync.Api.Interfaces;
using ClipboardSync.Api.Models;
using StackExchange.Redis;

namespace ClipboardSync.Api.Repositories;

public class UserRepository(IConnectionMultiplexer redis) : IUserRepository
{
    private readonly IDatabase _db = redis.GetDatabase();

    public async Task<User> CreateAsync(User user)
    {
        var hashEntries = new[]
        {
            new HashEntry("UserName", user.UserName),
            new HashEntry("Email", user.Email),
            new HashEntry("Password", user.Password),
            new HashEntry("Salt", user.Salt),
            new HashEntry("Id", user.Id.ToString()),
            new HashEntry("CreatedAt", user.CreatedAt.ToString("O"))
        };
        await _db.HashSetAsync($"user:{user.Id}", hashEntries);
        await _db.SetAddAsync("users", $"user:{user.Id}");
        return user;
    }

    public async Task<User?> GetByIdAsync(Guid id)
    {
        var hash = await _db.HashGetAllAsync($"user:{id}");
        if (hash.Length == 0) return null;

        return new User
        {
            Id = Guid.Parse(hash.First(h => h.Name == "Id").Value!),
            UserName = hash.First(h => h.Name == "UserName").Value!,
            Email = hash.First(h => h.Name == "Email").Value!,
            Password = hash.First(h => h.Name == "Password").Value!,
            Salt = hash.First(h => h.Name == "Salt").Value!,
            CreatedAt = DateTime.Parse(hash.First(h => h.Name == "CreatedAt").Value!)
        };
    }

    public async Task DeleteAsync(Guid id)
    {
        await _db.KeyDeleteAsync($"user:{id}");
    }

    public async Task<User?> GetByUserNameAsync(string userName)
    {
        var userKey = await _db.SetMembersAsync("users"); 
        foreach (var key in userKey)
        {
            var userHash = await _db.HashGetAllAsync(key.ToString());
            var user = userHash.ToDictionary(
                x => x.Name.ToString(),
                x => x.Value.ToString()
            );
            if (user.ContainsKey("UserName") && user["UserName"].Equals(userName, StringComparison.OrdinalIgnoreCase))
            {
                return new User
                {
                    Id = Guid.Parse(user["Id"]),
                    UserName = user["UserName"],
                    Email = user.TryGetValue("Email", out var value) ? value : string.Empty,
                    Password = user["Password"],
                    CreatedAt = DateTime.Parse(user["CreatedAt"])
                };
            }
        }
        return null;
    }
}
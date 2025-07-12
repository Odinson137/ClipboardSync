namespace ClipboardSync.Server.Interfaces;

public interface IRedisDb
{
    Task<T> GetEntityAsync<T>(string key);
}
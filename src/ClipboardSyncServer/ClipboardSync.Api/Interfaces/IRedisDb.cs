namespace ClipboardSync.Api.Interfaces;

public interface IRedisDb
{
    Task<T> GetEntityAsync<T>(string key);
}
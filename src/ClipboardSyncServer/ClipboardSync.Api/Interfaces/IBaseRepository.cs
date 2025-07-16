namespace ClipboardSync.Api.Interfaces;

public interface IBaseRepository<T>
{
    Task<T> CreateAsync(T entity);
    
    Task<T?> GetByIdAsync(Guid id);
    
    Task DeleteAsync(Guid id);
}
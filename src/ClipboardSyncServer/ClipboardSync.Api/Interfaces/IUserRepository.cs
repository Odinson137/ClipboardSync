using ClipboardSync.Api.Models;

namespace ClipboardSync.Api.Interfaces;

public interface IUserRepository : IBaseRepository<User>
{
    Task<User?> GetByUserNameAsync(string userName);
}
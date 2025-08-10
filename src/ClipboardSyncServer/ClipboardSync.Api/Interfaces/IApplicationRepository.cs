using ClipboardSync.Api.Models;

namespace ClipboardSync.Api.Interfaces;

public interface IApplicationRepository : IBaseRepository<Application>
{
    Task UpdateAsync(Application application);

    Task<Application?> GetByUserIdAndDeviceIdentifierAsync(Guid userId, string deviceIdentifier);
}
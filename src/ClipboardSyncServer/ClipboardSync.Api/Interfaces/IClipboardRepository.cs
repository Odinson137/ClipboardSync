using ClipboardSync.Api.Models;

namespace ClipboardSync.Api.Interfaces;

public interface IClipboardRepository : IBaseRepository<Clipboard>
{
    Task<IEnumerable<Clipboard>> GetByUserIdAsync(Guid userId);
}
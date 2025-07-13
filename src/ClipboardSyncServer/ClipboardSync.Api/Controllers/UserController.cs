using Microsoft.AspNetCore.Mvc;
using ClipboardSync.Api.Models;

namespace ClipboardSync.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UserController : ControllerBase
{
    // Временное хранилище для теста
    private static readonly List<User> _users = new();

    // Модель для запросов
    public record UserRequest(string UserName, string Password);

    [HttpPost("register")]
    public IActionResult Register([FromBody] UserRequest request)
    {
        if (string.IsNullOrEmpty(request.UserName) || string.IsNullOrEmpty(request.Password))
        {
            return BadRequest("Username and password are required.");
        }

        if (_users.Any(u => u.UserName == request.UserName))
        {
            return Conflict("Username already exists.");
        }

        var salt = BCrypt.Net.BCrypt.GenerateSalt();
        var hashedPassword = BCrypt.Net.BCrypt.HashPassword(request.Password, salt);

        var user = new User
        {
            UserName = request.UserName,
            Password = hashedPassword,
            Salt = salt
        };

        _users.Add(user);
        return Ok(new { Token = user.Id, Message = "User registered." }); // пока токен это id
    }

    [HttpPost("login")]
    public IActionResult Login([FromBody] UserRequest request)
    {
        if (string.IsNullOrEmpty(request.UserName) || string.IsNullOrEmpty(request.Password))
        {
            return BadRequest("Username and password are required.");
        }

        var user = _users.FirstOrDefault(u => u.UserName == request.UserName);
        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.Password))
        {
            return Unauthorized("Invalid username or password.");
        }

        return Ok(new { Token = user.Id, Message = "Login successful." });
    }
}
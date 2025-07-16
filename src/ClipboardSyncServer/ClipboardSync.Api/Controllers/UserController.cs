using ClipboardSync.Api.Interfaces;
using Microsoft.AspNetCore.Mvc;
using ClipboardSync.Api.Models;

namespace ClipboardSync.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UserController : ControllerBase
{
    private readonly IUserRepository _userRepository;
    private readonly ILogger<UserController> _logger;

    public UserController(IUserRepository userRepository, ILogger<UserController> logger)
    {
        _userRepository = userRepository;
        _logger = logger;
    }

    public record UserRequest(string UserName, string Password);

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] UserRequest request)
    {
        _logger.LogInformation($"Registering user {request.UserName}");
        if (string.IsNullOrEmpty(request.UserName) || string.IsNullOrEmpty(request.Password))
        {
            _logger.LogError($"User {request.UserName} and password are required");
            return BadRequest("Username and password are required.");
        }

        var existingUser = await _userRepository.GetByIdAsync(Guid.NewGuid()); // Проверка по UserName не поддерживается в базовом варианте
        if (existingUser != null)
        {
            _logger.LogError($"User {request.UserName} already exists");
            return Conflict("User ID conflict (try again).");
        }

        var salt = BCrypt.Net.BCrypt.GenerateSalt();
        var hashedPassword = BCrypt.Net.BCrypt.HashPassword(request.Password, salt);

        var user = new User
        {
            UserName = request.UserName,
            Password = hashedPassword,
            Salt = salt,
            Email = string.Empty
        };

        await _userRepository.CreateAsync(user);
        _logger.LogInformation($"User {request.UserName} registered");
        return Ok(new { UserId = user.Id, Message = "User registered." });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] UserRequest request)
    {
        _logger.LogInformation($"Logining user {request.UserName}");
        if (string.IsNullOrEmpty(request.UserName) || string.IsNullOrEmpty(request.Password))
        {
            _logger.LogError($"User {request.UserName} and password are required");
            return BadRequest("Username and password are required.");
        }

        // Для теста ищем по ID (в реальном проекте добавьте индекс по UserName)
        var user = await _userRepository.GetByUserNameAsync(request.UserName); // Замените на реальный поиск по UserName
        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.Password))
        {
            _logger.LogError($"User {request.UserName} and password do not match");
            return Unauthorized("Invalid username or password.");
        }

        _logger.LogInformation($"User {request.UserName} logged in");
        return Ok(new { UserId = user.Id, Message = "Login successful." });
    }
}
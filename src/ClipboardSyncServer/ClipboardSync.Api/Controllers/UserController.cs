using ClipboardSync.Api.Interfaces;
using Microsoft.AspNetCore.Mvc;
using ClipboardSync.Api.Models;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace ClipboardSync.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UserController : ControllerBase
{
    private readonly IUserRepository _userRepository;
    private readonly ILogger<UserController> _logger;
    private readonly IConfiguration _configuration;

    public UserController(IUserRepository userRepository, ILogger<UserController> logger, IConfiguration configuration)
    {
        _userRepository = userRepository;
        _logger = logger;
        _configuration = configuration;
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

        var existingUser = await _userRepository.GetByUserNameAsync(request.UserName);
        if (existingUser != null)
        {
            _logger.LogError($"User {request.UserName} already exists");
            return Conflict("User already exists.");
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

        var user = await _userRepository.GetByUserNameAsync(request.UserName);
        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.Password))
        {
            _logger.LogError($"User {request.UserName} and password do not match");
            return Unauthorized("Invalid username or password.");
        }

        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes("oPBrgglXkQTe40n8jRlhDo1LOIJ9PWHj3DIh1cgaNKY="); // Замените на безопасный ключ
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity([
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.UserName)
            ]),
            Expires = DateTime.UtcNow.AddYears(1), // Максимальное время жизни для тестов (1 год)
            Issuer = "ClipboardSync",
            Audience = "ClipboardSyncClients",
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(key),
                SecurityAlgorithms.HmacSha256Signature)
        };
        var token = tokenHandler.CreateToken(tokenDescriptor);
        var jwtToken = tokenHandler.WriteToken(token);

        _logger.LogInformation($"User {request.UserName} logged in with JWT");
        return Ok(new { Token = jwtToken, Message = "Login successful." });
    }
}
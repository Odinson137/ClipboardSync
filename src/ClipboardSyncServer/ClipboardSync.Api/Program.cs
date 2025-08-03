using System.Text;
using System.Text.Unicode;
using ClipboardSync.Api.Hubs;
using ClipboardSync.Api.Interfaces;
using ClipboardSync.Api.Repositories;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.SignalR;
using Microsoft.IdentityModel.Tokens;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
var services = builder.Services;

builder.Services.AddSingleton<IConnectionMultiplexer>(ConnectionMultiplexer.Connect(builder.Configuration["Redis:ConnectionString"]!));
builder.Services.AddSingleton<IUserRepository, UserRepository>();
builder.Services.AddSingleton<IApplicationRepository, ApplicationRepository>();
builder.Services.AddSingleton<IClipboardRepository, ClipboardRepository>();
builder.Services.AddSingleton<ICommandRepository, CommandRepository>();

services.AddSignalR();
services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policyBuilder =>
    {
        policyBuilder.AllowAnyOrigin()
               .AllowAnyMethod()
               .AllowAnyHeader();
    });
});

services.AddSignalR().AddStackExchangeRedis(builder.Configuration["Redis:ConnectionString"]!, options =>
{
    options.Configuration.ChannelPrefix = new RedisChannel("ClipboardSync", RedisChannel.PatternMode.Auto);
});

services.AddControllers();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = "ClipboardSync",
            ValidAudience = "ClipboardSyncClients",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("oPBrgglXkQTe40n8jRlhDo1LOIJ9PWHj3DIh1cgaNKY=")), // 32 символа = 32 байта),
            ClockSkew = TimeSpan.Zero // Нет дополнительного времени
        };
    });

builder.Services.AddAuthorization();


var app = builder.Build();

// Configure the HTTP request pipeline.
app.UseCors("AllowAll");
app.UseHttpsRedirection();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<ClipboardSyncHub>("/hub/clipboardsync");

app.MapGet("/", () => "Main api page!");
app.MapGet("/health", () => "true");

app.Run();
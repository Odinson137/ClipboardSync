using ClipboardSync.Api.Hubs;
using ClipboardSync.Api.Interfaces;
using ClipboardSync.Api.Repositories;
using Microsoft.AspNetCore.SignalR;
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

var app = builder.Build();

// Configure the HTTP request pipeline.
app.UseCors("AllowAll");
app.UseHttpsRedirection();
app.UseRouting();
app.UseAuthorization();
app.MapControllers();
app.MapHub<ClipboardSyncHub>("/hub/clipboardsync");

app.MapGet("/", () => "Main api page!");

app.Urls.Add("http://0.0.0.0:8080");

app.Run();
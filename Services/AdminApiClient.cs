using System.Net.Http.Json;
using FFRastenfeld.Models;

namespace FFRastenfeld.Services;

public class AdminApiClient
{
    private readonly HttpClient _http;

    public AdminApiClient(HttpClient http) => _http = http;

    public async Task<bool> HasSessionAsync()
    {
        var result = await _http.GetFromJsonAsync<SessionResponse>("api/admin/session");
        return result?.Authenticated == true;
    }

    public async Task<ApiResult> LoginAsync(AdminLoginRequest request)
    {
        var response = await _http.PostAsJsonAsync("api/admin/login", request);
        return await ReadResult(response);
    }

    public Task LogoutAsync() => _http.PostAsync("api/admin/logout", null);

    public async Task<List<AdminDraft>> GetDraftsAsync() =>
        await _http.GetFromJsonAsync<List<AdminDraft>>("api/admin/drafts") ?? new();

    public async Task<AdminDraft?> GetDraftAsync(string id) =>
        await _http.GetFromJsonAsync<AdminDraft>($"api/admin/drafts/{Uri.EscapeDataString(id)}");

    public async Task<ApiResult> SaveDraftAsync(AdminDraft draft)
    {
        var response = await _http.PostAsJsonAsync("api/admin/drafts", draft);
        return await ReadResult(response);
    }

    public async Task<ApiResult> GenerateAsync(AdminDraft draft)
    {
        var response = await _http.PostAsJsonAsync("api/admin/ai", draft);
        var result = await ReadResult(response);
        if (result.Success)
            result.Draft = await response.Content.ReadFromJsonAsync<AdminDraft>();
        return result;
    }

    public async Task<ApiResult> PublishAsync(AdminDraft draft)
    {
        var response = await _http.PostAsJsonAsync("api/admin/publish", draft);
        return await ReadResult(response);
    }

    private static async Task<ApiResult> ReadResult(HttpResponseMessage response)
    {
        if (response.IsSuccessStatusCode)
            return new ApiResult { Success = true };

        var error = await response.Content.ReadFromJsonAsync<ApiError>();
        return new ApiResult { Success = false, Message = error?.Message ?? "Die Aktion konnte nicht abgeschlossen werden." };
    }

    private sealed class SessionResponse { public bool Authenticated { get; set; } }
    private sealed class ApiError { public string? Message { get; set; } }
}

public class ApiResult
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public AdminDraft? Draft { get; set; }
}

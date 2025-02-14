// Check if we have an auth header and add it to all subsequent requests
const authHeader = localStorage.getItem('auth_header');
if (authHeader) {
    // Add authorization header to all fetch requests
    const originalFetch = window.fetch;
    window.fetch = function (url, options = {}) {
        options.headers = {
            ...options.headers,
            'Authorization': authHeader
        };
        return originalFetch(url, options);
    };

    // Also add the header to the current page
    fetch(window.location.href, {
        headers: {
            'Authorization': authHeader
        }
    })
        .then(response => {
            if (response.ok) {
                window.location.reload();
            }
        });
} 
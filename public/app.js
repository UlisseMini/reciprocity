async function loadUserInfo() {
    const response = await fetch('/api/me');
    const userData = await response.json();

    document.getElementById('username').textContent = `${userData.username}`;
    if (userData.avatar) {
        document.getElementById('avatar').src =
            `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`;
    }
}

async function loadAllUsers() {
    try {
        const response = await fetch('/api/users');
        const users = await response.json();

        const container = document.getElementById('users-container');
        container.innerHTML = users
            .map(user => {
                const avatarUrl = user.avatar
                    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
                    : 'https://cdn.discordapp.com/embed/avatars/0.png';

                const lastLogin = new Date(user.lastLogin).toLocaleString();

                return `
                    <div class="user-card">
                        <img src="${avatarUrl}" alt="${user.username}'s avatar">
                        <div class="user-details">
                            <div>${user.username}</div>
                            <div class="last-login">Last login: ${lastLogin}</div>
                        </div>
                    </div>
                `;
            })
            .join('');
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

loadUserInfo();
loadAllUsers(); 
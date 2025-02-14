let mutualMatches = [];

async function loadUserInfo() {
    const response = await fetch('/api/me');
    const userData = await response.json();

    document.getElementById('username').textContent = `${userData.username}`;
    if (userData.avatar) {
        document.getElementById('avatar').src =
            `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`;
    }
}

const WOULD_OPTIONS = ['date', 'cuddle', 'suck toes'];

async function modifyRelation(targetUserId, would, shouldDelete) {
    const confirmed = shouldDelete ? true : confirm('ARE YOU ABSOLUTELY CERTAIN??');
    if (!confirmed) {
        // If not confirmed, reset the checkbox to its previous state
        const checkbox = document.getElementById(`${targetUserId}-${would}`);
        checkbox.checked = !shouldDelete;
        return;
    }

    try {
        const response = await fetch('/api/relations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                targetUserId,
                would,
                delete: shouldDelete
            })
        });

        const result = await response.json();

        if (!shouldDelete && result.isMatched) {
            alert('YOU MATCHED!!!!');
        }

        // Refresh both relations and matches
        await Promise.all([loadRelations(), loadMatches()]);
        // Reload the users to update the match indicators
        await loadAllUsers();
    } catch (error) {
        console.error('Error modifying relation:', error);
        alert('Something went wrong!');
        // Reset checkbox to previous state on error
        const checkbox = document.getElementById(`${targetUserId}-${would}`);
        checkbox.checked = shouldDelete;
    }
}

async function loadRelations() {
    try {
        const response = await fetch('/api/relations');
        const relations = await response.json();

        // Clear existing checkboxes first
        WOULD_OPTIONS.forEach(would => {
            const checkboxes = document.querySelectorAll(`input[id$="-${would}"]`);
            checkboxes.forEach(checkbox => checkbox.checked = false);
        });

        // Set checkboxes based on existing relations
        relations.forEach(relation => {
            const checkbox = document.getElementById(`${relation.targetUserId}-${relation.would}`);
            if (checkbox) {
                checkbox.checked = true;
            }
        });
    } catch (error) {
        console.error('Error loading relations:', error);
    }
}

async function loadMatches() {
    try {
        const response = await fetch('/api/matches');
        mutualMatches = await response.json();
    } catch (error) {
        console.error('Error loading matches:', error);
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

                const wouldCheckboxes = WOULD_OPTIONS
                    .map(would => {
                        // Check if this is a mutual match
                        const isMatch = mutualMatches.some(match =>
                            match.otherUserId === user.id && match.would === would
                        );

                        return `
                            <div class="would-checkbox ${isMatch ? 'matched' : ''}">
                                <input 
                                    type="checkbox" 
                                    id="${user.id}-${would}"
                                    onchange="modifyRelation('${user.id}', '${would}', !this.checked)"
                                >
                                ${isMatch ? '<span class="match-indicator">✓</span>' : ''}
                            </div>
                        `;
                    })
                    .join('');

                return `
                    <div class="user-row">
                        <div class="user-info-col">
                            <img src="${avatarUrl}" alt="${user.username}'s avatar">
                            <div class="user-details">
                                <div>${user.username}</div>
                                <div class="last-login">Last login: ${lastLogin}</div>
                            </div>
                        </div>
                        <div class="would-cols">
                            ${wouldCheckboxes}
                        </div>
                    </div>
                `;
            })
            .join('');

        // After populating users, only load relations since matches are already loaded
        await loadRelations();
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Initialize everything
async function initialize() {
    await Promise.all([
        loadUserInfo(),
        loadMatches()  // Load matches immediately on page load
    ]);
    await loadAllUsers();
}

// Replace the direct function calls at the bottom with initialize()
initialize(); 
async function jsonFetch(url, ...args) {
    const response = await fetch(url, ...args);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

async function loadUserInfoHeader() {
    const userData = await jsonFetch('/api/me');

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
        const result = await jsonFetch('/api/relations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                targetUserId,
                would,
                delete: shouldDelete
            })
        });

        // Refresh the users table
        await loadUsersTable();
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

async function loadUsersTable() {
    try {
        const [users, mutualMatches, optOuts] = await Promise.all([
            jsonFetch('/api/users'),
            jsonFetch('/api/matches'),
            jsonFetch('/api/opt-outs')
        ]);

        const optedOutCategories = new Set(optOuts.map(opt => opt.would));

        const container = document.getElementById('users-container');
        container.innerHTML = users
            .map(user => {
                const avatarUrl = user.avatar
                    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
                    : 'https://cdn.discordapp.com/embed/avatars/0.png';

                const lastLogin = new Date(user.lastLogin).toLocaleString();

                const wouldCheckboxes = WOULD_OPTIONS
                    .map(would => {
                        const match = mutualMatches.find(match =>
                            match.otherUserId === user.id && match.would === would
                        );
                        const isMatch = !!match;
                        const isOptedOut = isMatch && match.optOut;
                        const isCategoryOptedOut = optedOutCategories.has(would);

                        return `
                            <div class="would-checkbox ${isMatch ? 'matched' : ''} ${isOptedOut ? 'opted-out' : ''}">
                                <input 
                                    type="checkbox" 
                                    id="${user.id}-${would}"
                                    onchange="modifyRelation('${user.id}', '${would}', !this.checked)"
                                    ${isCategoryOptedOut ? 'disabled' : ''}
                                >
                                ${isMatch && !isOptedOut ? '<span class="match-indicator">✓</span>' : ''}
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

async function toggleOptOut(would) {
    try {
        const button = document.getElementById(`opt-out-${would.replace(' ', '-')}`);
        const currentState = button.classList.contains('opted-out');

        await jsonFetch('/api/opt-out', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                would: would,
                delete: currentState
            })
        });

        // Update button state
        button.classList.toggle('opted-out');
        button.textContent = currentState ? 'Opt Out' : 'Opted Out';

        // Refresh the users table to show updated state
        await loadUsersTable();
    } catch (error) {
        console.error('Error toggling opt-out:', error);
        alert('Something went wrong!');
    }
}

async function loadOptOutStates() {
    try {
        const optOuts = await jsonFetch('/api/opt-outs');

        // Update all opt-out buttons
        WOULD_OPTIONS.forEach(would => {
            const button = document.getElementById(`opt-out-${would.replace(' ', '-')}`);
            const isOptedOut = optOuts.some(opt => opt.would === would);
            button.textContent = isOptedOut ? 'Opted Out' : 'Opt Out';
            button.classList.toggle('opted-out', isOptedOut);
        });
    } catch (error) {
        console.error('Error loading opt-out states:', error);
    }
}

// async and can happen at the same time
loadUserInfoHeader()
loadUsersTable()
loadOptOutStates()
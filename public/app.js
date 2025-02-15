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

const WOULD_OPTIONS = [
    {
        id: 'date',
        label: 'Would Date',
        description: 'Would go on a date with 🥺'
    },
    {
        id: 'hookup',
        label: 'Would Hook Up',
        description: '😳'
    },
    {
        id: 'dinner',
        label: 'Get Dinner With',
        description: 'Non-romantic dinner date!'
    },
    {
        id: 'intimate_talk',
        label: 'Would Have Deep 1-1',
        description: '1-1 with total openness and vulnerability'
    },
    {
        id: 'host',
        label: 'Would Host',
        description: 'Happy to host them at your place'
    },
    {
        id: 'makeout',
        label: 'Would Make Out',
        description: 'Without further expectations️ :)'
    }
]

document.documentElement.style.setProperty('--option-count', WOULD_OPTIONS.length);

async function modifyRelation(targetUserId, would, shouldDelete) {
    // If we're trying to check the box (shouldDelete is false), confirm first
    if (!shouldDelete) {
        const confirmed = confirm('ARE YOU ABSOLUTELY CERTAIN??');
        if (!confirmed) {
            return; // Just return - no need to modify the checkbox as it hasn't been changed yet
        }
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

        if (!shouldDelete && result.isMatched) {
            // wait for ui refresh before showing alert
            await new Promise(r => setTimeout(r, 100));
            alert('YOU MATCHED!!!!');
        }
    } catch (error) {
        console.error('Error modifying relation:', error);
        alert('Something went wrong :(');
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
            const checkboxes = document.querySelectorAll(`input[id$="-${would.id}"]`);
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

function generateExplanationsHtml() {
    return `
        <div class="explanations">
            <h3>What These Mean:</h3>
            <div class="explanation-grid">
                ${WOULD_OPTIONS.map(would => `
                    <div class="explanation-item">
                        <strong>${would.label}:</strong>
                        <span>${would.description}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function generateUserCard(user, mutualMatches) {
    const avatarUrl = user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : 'https://cdn.discordapp.com/embed/avatars/0.png';

    return `
        <div class="user-card">
            <div class="user-info">
                <img src="${avatarUrl}" alt="${user.username}'s avatar">
                <div class="user-details">
                    <div class="username">${user.username}</div>
                </div>
            </div>
            <div class="would-options">
                ${WOULD_OPTIONS.map(would => {
        const isMatch = mutualMatches.some(match =>
            match.otherUserId === user.id && match.would === would.id
        );
        return `
                        <label class="would-option ${isMatch ? 'matched' : ''}">
                            <input 
                                type="checkbox" 
                                id="${user.id}-${would.id}"
                                onclick="return handleWouldClick(event, '${user.id}', '${would.id}')"
                            >
                            <span class="option-label">${would.label}</span>
                            ${isMatch ? '<span class="match-indicator">✓</span>' : ''}
                        </label>
                    `;
    }).join('')}
            </div>
        </div>
    `;
}

async function handleWouldClick(event, targetUserId, would) {
    const checkbox = event.target;
    const alreadyChecked = !checkbox.checked;

    // If the checkbox is already checked, prevent unchecking
    if (alreadyChecked) {
        console.log('checkbox already checked');
        event.preventDefault();
        return false;
    }

    const confirmed = confirm('ARE YOU ABSOLUTELY CERTAIN??\n\nThis cannot be undone - your choice will be permanent and if you match they will expect you to keep your word!');
    if (!confirmed) {
        event.preventDefault();
        return false;
    }

    try {
        const result = await jsonFetch('/api/relations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                targetUserId,
                would,
            })
        });

        // Refresh the users table
        await loadUsersTable();

        if (result.isMatched) {
            // wait for ui refresh before showing alert
            await new Promise(r => setTimeout(r, 100));
            alert('YOU MATCHED!!!!');
        }
    } catch (error) {
        console.error('Error modifying relation:', error);
        alert('Something went wrong :(');
        event.preventDefault();
        return false;
    }
}

async function loadUsersTable() {
    try {
        const [users, mutualMatches] = await Promise.all([
            jsonFetch('/api/users'),
            jsonFetch('/api/matches')
        ]);

        // Add explanations section
        const explanationsContainer = document.getElementById('explanations-container');
        explanationsContainer.innerHTML = generateExplanationsHtml();

        const container = document.getElementById('users-container');
        container.innerHTML = users
            .map(user => generateUserCard(user, mutualMatches))
            .join('');

        // After populating users, only load relations since matches are already loaded
        await loadRelations();
    } catch (error) {
        alert('Something went wrong :(');
        console.error('Error loading users:', error);
    }
}

// async and can happen at the same time
loadUserInfoHeader()
loadUsersTable()
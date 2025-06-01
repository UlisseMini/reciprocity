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
        id: 'mutual_support',
        label: 'Be there for each other',
        description: 'I would be honored for you to reach out to me for support when you need it, and I feel confident in my ability to say no when it\'s too much for me, so feel free to reach out. AND I would love to occasionally call you for support, if you would feel honored by that, and you feel comfortable saying no before I become a burden to you -- I\'d love to be supported when I know it\'s an honor for you, not a burden. This is mutual support where we both want to be there for each other.'
    }
    // Alternative label suggestions:
    // - "Mutual support"
    // - "Be there for each other" 
    // - "Support each other"
    // - "There for you"
    // - "Connected support"
    // - "Honor to support",
    // Previous options (from when this was a dating app):
    // {
    //     id: 'date',
    //     label: 'Go On Date',
    //     description: 'Would go on a date if they wanted to 🥺'
    // },
    // {
    //     id: 'hookup',
    //     label: 'Would Hook Up',
    //     description: '😳'
    // },
    // {
    //     id: 'dinner',
    //     label: 'Get Dinner With',
    //     description: 'Non-romantic dinner date!'
    // },
    // {
    //     id: 'intimate_talk',
    //     label: 'Would Have Deep 1-1',
    //     description: '1-1 with high openness and vulnerability'
    // },
    // {
    //     id: 'host',
    //     label: 'Would Host',
    //     description: 'Happy to host them at your place'
    // },
    // {
    //     id: 'makeout',
    //     label: 'Would Make Out',
    //     description: 'Without further expectations️ :)'
    // },
    // {
    //     id: 'scary',
    //     label: 'Scary',
    //     description: 'Scary smart / competent!'
    // }
]

document.documentElement.style.setProperty('--option-count', WOULD_OPTIONS.length);

async function modifyRelation(targetUserId, would, shouldDelete) {
    // If we're trying to check the box (shouldDelete is false), confirm first
    if (!shouldDelete) {
        const confirmed = confirm('Are you sure you want to offer mutual support with this person?');
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
            alert('You both want to support each other! You can now reach out when you need someone to talk to.');
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

    // Show display name if available, otherwise show username
    const displayName = user.displayName || user.username;
    const showUsername = user.displayName && user.displayName !== user.username;

    return `
        <div class="user-card">
            <div class="user-info">
                <img src="${avatarUrl}" alt="${displayName}'s avatar">
                <div class="user-details">
                    <div class="username">${displayName}</div>
                    ${showUsername ? `<div class="real-username">@${user.username}</div>` : ''}
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
                                onchange="modifyRelation('${user.id}', '${would.id}', !this.checked)"
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

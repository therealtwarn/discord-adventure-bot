// MINIMAL BOT - Save as bot.js and run with: node bot.js
// First run: npm init -y && npm install discord.js

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// ========== CONFIGURATION - Edit these values ==========
const CONFIG = {
    token: 'YOUR_BOT_TOKEN_HERE',
    guildId: '1392611737555177612',
    channelId: '1394077538808238210',
    intervalMinutes: 7.5
};

// ========== STORIES DATA (Replace with your 100 stories) ==========
const STORIES = [
    { tier: 1, story: 1, title: "The Forge Awakens", content: "A digital artisan discovers the Creative Forge..." },
    { tier: 1, story: 2, title: "First Creation", content: "The blockchain hums with approval..." },
    { tier: 1, story: 3, title: "Community Gathers", content: "Artists arrive from across the metaverse..." },
    { tier: 1, story: 4, title: "Sapphires in Code", content: "Deep within smart contracts, rewards crystallize..." },
    // Add remaining 96 stories here
];

// ========== STATE (Persisted in memory) ==========
let state = {
    currentIndex: 0,
    totalAdventures: 0
};

// ========== BOT LOGIC ==========
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

async function runLottery() {
    try {
        const guild = await client.guilds.fetch(CONFIG.guildId);
        const channel = await guild.channels.fetch(CONFIG.channelId);
        const members = await guild.members.fetch();
        
        // Filter online members (not bots)
        const eligible = members.filter(m => !m.user.bot && m.presence?.status !== 'offline');
        const memberArray = Array.from(eligible.values());
        
        if (memberArray.length < 5) {
            console.log('Not enough online members');
            return;
        }
        
        // Select 5 random winners
        const winners = [];
        for (let i = 0; i < 5; i++) {
            const idx = Math.floor(Math.random() * memberArray.length);
            winners.push(memberArray.splice(idx, 1)[0]);
        }
        
        // Get current story
        const story = STORIES[state.currentIndex] || STORIES[0];
        const tier = Math.floor(state.currentIndex / 4) + 1;
        const sparksReward = 10 + ((tier - 1) * 5);
        const sapphireReward = 5 + ((tier - 1) * 3);
        
        // Create embed
        const embed = new EmbedBuilder()
            .setTitle(`🎭 ${story.title}`)
            .setDescription(story.content)
            .setColor(0x7B68EE)
            .addFields(
                {
                    name: '✨ SPARKS Winners',
                    value: winners.slice(0, 3).map(w => `${w.user.tag} - **${sparksReward}**`).join('\n'),
                    inline: true
                },
                {
                    name: '💎 SAPPHIRE Winners', 
                    value: winners.slice(3, 5).map(w => `${w.user.tag} - **${sapphireReward}**`).join('\n'),
                    inline: true
                }
            )
            .setFooter({ text: `Adventure ${state.totalAdventures + 1} | Tier ${tier}` })
            .setTimestamp();
        
        await channel.send({ embeds: [embed] });
        
        // Update state
        state.totalAdventures++;
        state.currentIndex = (state.currentIndex + 1) % STORIES.length;
        
        // Log rewards (append to file)
        const fs = require('fs');
        const log = {
            timestamp: new Date().toISOString(),
            adventure: state.totalAdventures,
            sparks: winners.slice(0, 3).map(w => ({ user: w.user.tag, amount: sparksReward })),
            sapphires: winners.slice(3, 5).map(w => ({ user: w.user.tag, amount: sapphireReward }))
        };
        fs.appendFileSync('rewards.json', JSON.stringify(log) + '\n');
        
    } catch (error) {
        console.error('Lottery error:', error);
    }
}

// Start bot
client.once('ready', () => {
    console.log(`Bot online! Running lottery every ${CONFIG.intervalMinutes} minutes`);
    
    // Run lottery on interval
    setInterval(runLottery, CONFIG.intervalMinutes * 60 * 1000);
    
    // Run once on startup (optional)
    // runLottery();
});

// Manual trigger command
client.on('messageCreate', async message => {
    if (message.content === '!lottery' && message.member?.permissions.has('Administrator')) {
        await runLottery();
    }
});

client.login(CONFIG.token);
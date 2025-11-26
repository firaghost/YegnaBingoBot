// Tournament Debug Helper
// Paste this in browser console on the lobby page to debug tournament issues

console.log('=== TOURNAMENT DEBUG HELPER ===');
console.log('Current time (local):', new Date().toString());
console.log('Current time (ISO):', new Date().toISOString());
console.log('');

// Fetch tournaments
fetch('/api/tournaments')
    .then(res => res.json())
    .then(data => {
        console.log('API Response:', data);
        const tournaments = data?.tournaments || [];
        console.log('Total tournaments returned:', tournaments.length);

        if (tournaments.length === 0) {
            console.log('❌ No tournaments found!');
            console.log('');
            console.log('Possible reasons:');
            console.log('1. No tournaments in database');
            console.log('2. Tournament is_enabled = false');
            console.log('3. Tournament status not "live" or "upcoming"');
            console.log('4. Tournament start_at > now (not started yet)');
            console.log('5. Tournament end_at < now (already ended)');
        } else {
            tournaments.forEach((t, idx) => {
                console.log(`\n--- Tournament ${idx + 1}: ${t.name} ---`);
                console.log('ID:', t.id);
                console.log('Status:', t.status);
                console.log('Is Enabled:', t.is_enabled);
                console.log('Start:', t.start_at, new Date(t.start_at).toString());
                console.log('End:', t.end_at, new Date(t.end_at).toString());
                console.log('Started?', new Date(t.start_at) <= new Date());
                console.log('Not Ended?', new Date(t.end_at) >= new Date());
                console.log('Is Live?', t.status === 'live');
                console.log('Will show in lobby?', t.status === 'live' && new Date(t.start_at) <= new Date() && new Date(t.end_at) >= new Date());
            });
        }
    })
    .catch(err => {
        console.error('❌ Error fetching tournaments:', err);
    });

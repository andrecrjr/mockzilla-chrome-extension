// Array of possible headlines - action-oriented and benefit-focused
const headlines = [
    "Mock APIs in 30 Seconds ⚡",
    "Your QA Team's Best Friend 🤖",
    "Stop Waiting for Backend Teams 🚀",
    "Test Any API Response Instantly 💨",
    "Build Faster with Realistic Mocks ⚙️",
    "Your Frontend Team's Best Friend 🤖",
    "Your Backend Team's Best Friend 🤖",
    "Deploy Your Mock Server Now 🔥",
    "Intercept Requests in Real-Time 🎯",
    "Ship Features Without Backend Delays 🏃",
    "Prototype at Lightning Speed ⚡",
    "Never Block on APIs Again 🚫",
    "From Zero to Mocking in Seconds ⏱️",
    "Your Backend, Your Rules 👑",
    "AI-Powered Mock Generation 🤖"
];

// Function to get a random headline (excluding current one)
function getRandomHeadline(currentHeadline) {
    const availableHeadlines = headlines.filter(h => h !== currentHeadline);
    const randomIndex = Math.floor(Math.random() * availableHeadlines.length);
    return availableHeadlines[randomIndex];
}

// Function to insert and rotate headlines
function insertDynamicHeadline() {
    const headlineElement = document.getElementById('dynamic-headline');
    if (headlineElement) {
        // Set initial headline
        headlineElement.textContent = headlines[0];
        headlineElement.style.transition = 'opacity 0.3s ease-in-out';
        
        // Rotate headlines every 3 seconds
        let currentHeadline = headlines[0];
        setInterval(() => {
            // Fade out
            headlineElement.style.opacity = '0';
            
            setTimeout(() => {
                // Change text
                currentHeadline = getRandomHeadline(currentHeadline);
                headlineElement.textContent = currentHeadline;
                
                // Fade in
                headlineElement.style.opacity = '1';
            }, 300);
        }, 7000);
    }
}

// Wait for the DOM to be fully loaded before inserting the headline
document.addEventListener('DOMContentLoaded', function() {
    insertDynamicHeadline();
});
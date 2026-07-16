#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');

// Configurations
const USERNAME = "yogeshdevx";
const BIRTHDATE_STR = "2004-12-15"; // Dec 15, 2004

function getUptime(startDateStr) {
    const today = new Date();
    const startDate = new Date(startDateStr);
    
    let years = today.getFullYear() - startDate.getFullYear();
    let months = today.getMonth() - startDate.getMonth();
    let days = today.getDate() - startDate.getDate();
    
    if (days < 0) {
        // borrow days from previous month
        const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        days += prevMonth.getDate();
        months -= 1;
    }
    if (months < 0) {
        months += 12;
        years -= 1;
    }
    
    const parts = [];
    if (years > 0) parts.push(`${years} year${years !== 1 ? 's' : ''}`);
    if (months > 0) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    return parts.join(', ');
}

function fetchJson(url) {
    return new Promise((resolve) => {
        const options = {
            headers: {
                'User-Agent': 'GithubStatsUpdater/1.0',
            }
        };
        const token = process.env.GITHUB_TOKEN;
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }
        
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(null);
                    }
                } else {
                    console.error(`Request failed with status ${res.statusCode} for ${url}`);
                    resolve(null);
                }
            });
        }).on('error', (err) => {
            console.error(`Error requesting ${url}: ${err.message}`);
            resolve(null);
        });
    });
}

async function main() {
    console.log("Calculating uptime/age...");
    const uptime = getUptime(BIRTHDATE_STR);
    console.log(`Uptime: ${uptime}`);
    
    console.log(`Fetching GitHub stats for ${USERNAME}...`);
    const userData = await fetchJson(`https://api.github.com/users/${USERNAME}`);
    const reposData = await fetchJson(`https://api.github.com/users/${USERNAME}/repos?per_page=100`);
    const contribSearch = await fetchJson(`https://api.github.com/search/repositories?q=contributor:${USERNAME}`);
    const commitSearch = await fetchJson(`https://api.github.com/search/commits?q=author:${USERNAME}`);
    
    // Fallbacks
    const followers = userData ? String(userData.followers || "10") : "10";
    const publicRepos = userData ? String(userData.public_repos || "12") : "12";
    
    let starsCount = 0;
    if (reposData && Array.isArray(reposData)) {
        for (const r of reposData) {
            starsCount += r.stargazers_count || 0;
        }
    }
    const stars = reposData ? String(starsCount) : "15";
    
    const contrib = contribSearch ? String(contribSearch.total_count || "18") : "18";
    const commits = commitSearch ? String(commitSearch.total_count || "250") : "250";
    
    console.log(`Stats fetched: Repos=${publicRepos}, Contrib=${contrib}, Stars=${stars}, Commits=${commits}, Followers=${followers}`);
    
    const files = ["dark_mode.svg", "light_mode.svg"];
    for (const file of files) {
        const filepath = path.join(__dirname, file);
        if (!fs.existsSync(filepath)) {
            console.warn(`File not found: ${filepath}`);
            continue;
        }
        
        let content = fs.readFileSync(filepath, 'utf8');
        
        // Parse existing loc values to preserve them
        const locMatch = content.match(/id="loc_data">([^<]+)<\/tspan>/);
        const locAddMatch = content.match(/id="loc_add">([^<]+)<\/tspan>/);
        const locDelMatch = content.match(/id="loc_del">([^<]+)<\/tspan>/);
        
        const locData = locMatch ? locMatch[1] : "12,500";
        const locAdd = locAddMatch ? locAddMatch[1] : "15,400";
        const locDel = locDelMatch ? locDelMatch[1] : "2,900";
        
        // 1. Update Uptime
        const uptimePattern = /(<tspan\s+[^>]*id="age_data_dots"[^>]*>)([^<]*)(<\/tspan><tspan\s+[^>]*id="age_data"[^>]*>)([^<]*)(<\/tspan>)/g;
        content = content.replace(uptimePattern, (match, g1, g2, g3, g4, g5) => {
            const newDotsCount = 49 - uptime.length;
            const newDots = " " + ".".repeat(Math.max(1, newDotsCount)) + " ";
            return `${g1}${newDots}${g3}${uptime}${g5}`;
        });
        
        // 2. Update Repos and Stars
        const reposPattern = /(<tspan\s+[^>]*id="repo_data_dots"[^>]*>)([^<]*)(<\/tspan><tspan\s+[^>]*id="repo_data"[^>]*>)([^<]*)(<\/tspan>\s*\{\s*<tspan\s+[^>]*class="key"[^>]*>Contributed<\/tspan>:\s*<tspan\s+[^>]*id="contrib_data"[^>]*>)([^<]*)(<\/tspan>\}\s*\|\s*<tspan\s+[^>]*class="key"[^>]*>Stars<\/tspan>:\s*<tspan\s+[^>]*id="star_data_dots"[^>]*>)([^<]*)(<\/tspan><tspan\s+[^>]*id="star_data"[^>]*>)([^<]*)(<\/tspan>)/g;
        content = content.replace(reposPattern, (match, g1, g2, g3, g4, g5, g6, g7, g8, g9, g10, g11) => {
            const newStarDotsCount = 18 - publicRepos.length - contrib.length - stars.length;
            const newStarDots = " " + ".".repeat(Math.max(1, newStarDotsCount)) + " ";
            return `${g1} .... ${g3}${publicRepos}${g5}${contrib}${g7}${newStarDots}${g9}${stars}${g11}`;
        });
        
        // 3. Update Commits and Followers
        const commitsPattern = /(<tspan\s+[^>]*id="commit_data_dots"[^>]*>)([^<]*)(<\/tspan><tspan\s+[^>]*id="commit_data"[^>]*>)([^<]*)(<\/tspan>\s*\|\s*<tspan\s+[^>]*class="key"[^>]*>Followers<\/tspan>:\s*<tspan\s+[^>]*id="follower_data_dots"[^>]*>)([^<]*)(<\/tspan><tspan\s+[^>]*id="follower_data"[^>]*>)([^<]*)(<\/tspan>)/g;
        content = content.replace(commitsPattern, (match, g1, g2, g3, g4, g5, g6, g7, g8, g9) => {
            const newCommitDotsCount = 24 - commits.length - followers.length;
            const newCommitDots = " " + ".".repeat(Math.max(1, newCommitDotsCount)) + " ";
            return `${g1}${newCommitDots}${g3}${commits}${g5} ........ ${g7}${followers}${g9}`;
        });
        
        // 4. Update Lines of Code
        const locPattern = /(<tspan\s+[^>]*id="loc_data_dots"[^>]*>)([^<]*)(<\/tspan><tspan\s+[^>]*id="loc_data"[^>]*>)([^<]*)(<\/tspan>\s*\(\s*<tspan\s+[^>]*id="loc_add"[^>]*>)([^<]*)(<\/tspan><tspan\s+[^>]*>\+\+<\/tspan>,\s*<tspan\s+[^>]*id="loc_del_dots"[^>]*>)([^<]*)(<\/tspan><tspan\s+[^>]*id="loc_del"[^>]*>)([^<]*)(<\/tspan><tspan\s+[^>]*>--<\/tspan>\s*\))/g;
        content = content.replace(locPattern, (match, g1, g2, g3, g4, g5, g6, g7, g8, g9, g10, g11) => {
            const newDelDotsCount = 18 - locData.length - locAdd.length - locDel.length;
            const newDelDots = ".".repeat(Math.max(0, newDelDotsCount)) + " ";
            return `${g1} ... ${g3}${locData}${g5}${locAdd}${g7}${newDelDots}${g9}${locDel}${g11}`;
        });
        
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`Updated ${file} successfully.`);
    }
}

main().catch(console.error);


var restify = require('restify');
var builder = require('botbuilder');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, () => {
   console.log('%s listening to %s', server.name, server.url); 
});

//appId : e5c08f46-7393-42a6-9c74-a6894352ff1d
//appPassword: 1n9OfYmOspFexqnrh3d3FLt


// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

// Receive messages from the user and respond by echoing each message back (prefixed with 'You said:')
var bot = new builder.UniversalBot(connector)

// Send welcome when conversation with bot is started, by initiating the root dialog
bot.on('conversationUpdate', (message) => {
    if (message.membersAdded) {
        message.membersAdded.forEach((identity) => {
            if (identity.id === message.address.bot.id) {
                bot.beginDialog(message.address, '/');
            }
        })
    }
})

bot.dialog('/', [
    (session, args, next) => {
        session.beginDialog('greetings', args)
    },
    (session, results) => {
        session.userData.profile = results.response
        session.beginDialog('activitySelector', session.userData.profile)        
    },
    (session, results) => {
        
        if(results.response){
            const { activity , progress }  = results.response

            if(progress.entity == "Yes"){
                session.beginDialog('activityProcessing', activity)     
            }else{
                next()
            }
        }     
    },
    (session, results) => {
        session.endConversation(`Thanks ${session.userData.profile.username} for doing business with us. Talk to you soon!`)
    }
])
.reloadAction('startOver', 'Ok, starting over.', {
    matches: /^start over$|^start again$|^restart$|^reset$/i
});

bot.dialog('greetings', [
    (session, args, next) => {
        
        if(args && args.redirected){
            session.send(`Sup ${username}? How's it hanging :) ? Please state your request.`);
        }else{
            session.send("Welcome to the Bot Helper.");
            
            session.dialogData.profile = args || {}
    
            if(session.dialogData.profile.username){
                session.send(`Welcome back ${session.dialogData.profile.username}.`)
                next()            
            }else{            
                builder.Prompts.text(session, 'Can I grab your name, please?');
            } 
        }       
    },
    (session, results) => {
        if(results.response){
            session.dialogData.profile.username = results.response;
        }
        
        session.endDialogWithResult({ response: session.dialogData.profile });
    },    
])

bot.dialog('activitySelector', [
    (session, args, next) => {
        session.userData.activity = {}     
        session.dialogData.profile = args
        builder.Prompts.text(session,`Sweet, my name is Skynet. What can I do for you ${session.dialogData.profile.username}?`);
    },
    async (session, results, next) => {        
        session.userData.activity.userentered = results.response;
        builder.Prompts.text(session, `Please give me a moment so I can check if [${results.response}] is something I can help you with.`)

        const isActivityAvailable = await isAvailableActivity(session.userData.activity.userentered);
        
        //
        //call LUIS to check Intent?
        //
        if(!isActivityAvailable){
            builder.Prompts.choice(session, 'Alright, these are all the activities I can help you with. Please pick one.', availableActivities, { listStyle: builder.ListStyle.button })
        }else{
            next({ response : session.userData.activity})
        }                  
    },
    (session, results) => {
        session.userData.activity.userselected = results.response
        builder.Prompts.choice(session, `You've selected [${results.response}], do you want me to continue processing your request?`, 'Yes|No', { listStyle: builder.ListStyle.button })
    }, 
    (session, results) => {
        const activity = {
            activity : session.userData.activity,
            progress : results.response
        }
        session.endDialogWithResult({ response: activity });             
    }
])

bot.dialog('activityProcessing', [
    (session, args, next) => {
        session.dialogData.activity = args || {}

        if(session.dialogData.activity){
            session.beginDialog(session.dialogData.activity.userselected, session.dialogData.activity)
        }else{
            next()
        }
    },
    (session, results) => {
        session.endDialogWithResult({ response: 'done' })   
    }
])

/**
 * HELP Bot Dialog
 */
bot.dialog('help', [
    (session, args, next) => {
        if(args.action){
            builder.Prompts.text(session, `What would you like to know about ${args.action}`);
        }else{
            builder.Prompts.text(session, `I see you have questions, anything specific you want me to help you with?`);
        }        
    },
    (session, results) => {        
        session.endDialog("Sorry dude I can't help you with that. Unless you buy the full licence you're doomed! Have fun :)")
    }
]).triggerAction({
    matches: /^help$|^need help$|^want help$|^require help$/i,
    onSelectAction: (session, args, next) => {
        session.beginDialog(args.action, args);
    }
});

/**
 * RESERVATION Bot Dialog
 */
bot.dialog('reserve_table', [
    (session, args, next) => {
        builder.Prompts.choice(session, `Reserve table then?`, 'Breakfast|Lunch|Dinner', { listStyle: builder.ListStyle.button })
    },
    (session, results) => {
        
    },    
    (session, results) => {
        session.endDialogWithResult({ response : 'done'})
    }
])
.triggerAction({
    matches : /^reserve$|^book$/i,    
})
.endConversationAction('CancelReservation','Reservation Cancelled', {
    matches : /^cancel$|^exit$|^kill$|^terminate$|^return$|^stop$/,
    confirmPrompt : "This will cancel your Reservation, Are you sure (yes/no)?"    
})
.beginDialogAction('HelpWithReservation', 'Help', { matches: /^help$/, dialogArgs: {action: 'Reservation'} });

/**
 * ORDER Bot Dialog
 */
bot.dialog('order', [
    (session, args, next) => {
        builder.Prompts.choice(session, `What are you after?`, 'Book|Hardware|Software|Food', { listStyle: builder.ListStyle.button })
    },
    (session, results) => {
        
    },    
    (session, results) => {
        session.endDialogWithResult({ response : 'done'})
    }
])
.triggerAction({
    matches : /^order$/i,    
})
.endConversationAction('CancelOrder','Order Cancelled', {
    matches : /^cancel$|^exit$|^kill$|^terminate$|^return$|^stop$/,
    confirmPrompt : "This will cancel your Order, Are you sure (yes/no)?"    
})
.beginDialogAction('HelpWithOrder', 'Help', { matches: /^help$/, dialogArgs: {action: 'Order'} });

/**
 * SEND_EMAIL Bot Dialog
 */
bot.dialog('send_email', [
    (session, args) => {
        if (args && args.reprompt) {
            builder.Prompts.text(session, "Oops, looks like it's invalid, gimme a proper email for god's sake!")
        } else {
            builder.Prompts.text(session, "Please provide a valid email address so I can proceed.");
        }
    },
    (session, results) => {
        var matched = results.response.match(/[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/g);
        if (matched) {
            var email = matched ? matched.join('') : '';
            session.userData.email = email; // Save the number.

            //Send email...
            session.send("Done, email sent. Anything else I can help you with?")

            session.replaceDialog("/", { redirected: true });
        } else {
            // Repeat the dialog
            session.replaceDialog('send_email', { reprompt: true });
        }
    }
])
.triggerAction({
    matches : /^send email$|^send$|^email$/i,    
})
.endConversationAction('CancelSendingEmail','Email Sending Cancelled', {
    matches : /^cancel$|^exit$|^kill$|^terminate$|^return$|^stop$/,
    confirmPrompt : "This will cancel sending Email, Are you sure (yes/no)?"    
})
.beginDialogAction('HelpWithSendingEmail', 'Help', { matches: /^help$/, dialogArgs: {action: 'SendingEmail'} });

/**
 * CALL_SOMEONE Bot Dialog
 */
bot.dialog('call_someone',[
    (session, args, next) => {
        builder.Prompts.text(session,'Sick. I am going to need a local phone number from you then')
    },
    (session, results) => {
        
    },    
    (session, results) => {
        session.endDialogWithResult({ response : 'done'})
    }
])
.triggerAction({
    matches : /^call$|^call someone$|^place a call$/i,    
})
.endConversationAction('CancelCalling','Calling Someone Cancelled', {
    matches : /^cancel$|^exit$|^kill$|^terminate$|^return$|^stop$/,
    confirmPrompt : "This will cancel calling Someone, Are you sure (yes/no)?"    
})
.beginDialogAction('HelpWithCallingSomeone', 'Help', { matches: /^help$/, dialogArgs: {action: 'CallingSomeone'} });

/**
 * GENERATE_RANDOM_MESSAGE Bot Dialog
 */
bot.dialog('generate_random_message',[
    (session, args, next) => {
        builder.Prompts.choice(session, `Generate a random message then? Happy or Sad?`, 'Happy|Sad', { listStyle: builder.ListStyle.button })
    },
    (session, results) => {

    },
    (session, results) => {
        session.endDialogWithResult({ response : 'done'})
    }
])
.triggerAction({
    matches : /^generate message$|^generate random message$/i,    
})
.endConversationAction('CancelGenerationRandomMessage','Generating Random Message Cancelled', {
    matches : /^cancel$|^exit$|^kill$|^terminate$|^return$|^stop$/,
    confirmPrompt : "This will cancel generation random Message, Are you sure (yes/no)?"    
})
.beginDialogAction('HelpWithGeneratingRandomMessage', 'Help', { matches: /^help$/, dialogArgs: {action: 'GeneratingRandomMessage'} });

/**
 * LAUNCH_NUCLEAR_MISSILE Bot Dialog
 */
bot.dialog('launch_nuclear_missile',[
    (session, args, next) => {
        builder.Prompts.text(session, 'Which country would you like to target')
    },
    (session, results) => {
        session.send(`Sweet, missile is on its way to ${results.response}`)
    },
    (session, results) => {
        session.endDialogWithResult({ response : 'done'})
    }
])
.triggerAction({
    matches : /^launch$|^nuclear$|^missile$/i,    
})
.endConversationAction('CancelMissileLaunch','Nuclear missile Launch is Cancelled', {
    matches : /^cancel$|^exit$|^kill$|^terminate$|^return$|^stop$/,
    confirmPrompt : "This will terminate the missile you've launched, Are you sure (yes/no)?"    
})
.beginDialogAction('HelpWithNuclearMissileLaunch', 'Help', { matches: /^help$/, dialogArgs: {action: 'LaunchNuclearMissile'} });


/**
 * DESTROY_HUMAN_RACE Bot Dialog
 */
bot.dialog('destroy_human_race',[
    (session, args, next) => {
        builder.Prompts.choice(session, 'Would you like to destroy the human race?', 'Sure, why not|Hmm, not sure', { listStyle: builder.ListStyle.button })
    },
    (session, results) => {
        session.send(`You've selected ${results.response}, BOOOOM! Done! Bye, bye`)
    },
    (session, results) => {
        session.endDialogWithResult({ response : 'done'})
    }
])
.triggerAction({
    matches : /^destroy$|^humanity$/i,
})
.endConversationAction('CancelDestroyHumanRace','Destroying Humanity is Cancelled', {
    matches : /^cancel$|^exit$|^kill$|^terminate$|^return$|^stop$/,
    confirmPrompt : "This will terminate your plane to destroy the human race, Are you sure (yes/no)?"    
})
.beginDialogAction('HelpWithDestroyHumanRace', 'Help', { matches: /^help$/, dialogArgs: {action: 'DestroyHumanRace'} });


var reserve_table = {code: 'Reserve table', desc: 'Reserve a table?'}
var order = {code: 'Order', desc: 'Order an item from Amazon'}
var send_email = {code: 'SendEmail', desc: 'Send an email to someone'}
var call_someone = {code: 'CallSomeone', desc: 'Call someone'}
var generate_random_message = {code: 'GenerateRandomMessage', desc: 'Generate a random message'}
var launch_nuclear_missile = { code: 'LaunchNuclearMissile', desc: 'Launch a nuclear missile'}
var destroy_human_race = { code: 'DestroyHumanRace', desc: 'Destroy the human race'}

var availableActivities = {reserve_table, order, send_email, call_someone, generate_random_message, launch_nuclear_missile, destroy_human_race}


isAvailableActivity = async (activity) => {
    await timeout(3000)
    //return availableActivities.includes(activity)

    Object.values(availableActivities).map((item) => {
        console.log(item)
    })
}

timeout = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

isValidEmail = (value) => {
    const EmailRegex = new RegExp(/[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+\/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/);
    return EmailRegex.test(value)
}
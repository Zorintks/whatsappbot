const { Client, LocalAuth } = require('whatsapp-web.js');  // Importa o Client e LocalAuth
const qrcode = require('qrcode-terminal');  // Para gerar o QR Code no terminal
const client = new Client({
    authStrategy: new LocalAuth(),  // Usa o LocalAuth para armazenar a autenticação
});

// Lista de IDs dos administradores autorizados a usar os comandos
const adminsList = [
    '556281206530@c.us', // ID de um administrador
    '552798708362@c.us',
    '558393214736@c.us',
    '558396668109@c.us',
    '554799560456@c.us',
];

let userLinkAttempts = {};  // Armazena a quantidade de links enviados por cada usuário

client.on('qr', (qr) => {
    // Quando o QR Code for gerado, exibe no terminal
    qrcode.generate(qr, { small: true });
    console.log('QR Code gerado. Escaneie para autenticar.');
});

client.on('ready', () => {
    // Quando o bot estiver pronto, informa no console
    console.log('Bot está pronto!');
});

client.on('ready', async () => {
    // Quando o bot estiver online, envia uma mensagem em todos os grupos
    console.log('Bot está online e pronto!');

    // Itera sobre todos os chats do bot
    const chats = await client.getChats();
    
    // Filtra os chats para garantir que seja um grupo (com '@g.us' no ID)
    const groupChats = chats.filter(chat => chat.isGroup);
    
    // Mensagem que o bot vai enviar quando ficar online
    const welcomeBotMessage = "🚨 O bot do Zorin ta on piazada 🚨";

    // Envia a mensagem em todos os grupos
    for (let chat of groupChats) {
        await chat.sendMessage(welcomeBotMessage);
    }

    console.log("Mensagem enviada para todos os grupos.");
});



client.on('message', async (msg) => {
    // Exibe log detalhado de cada mensagem recebida
    console.log(`Mensagem recebida de ${msg.from}: ${msg.body}`);
    console.log(`ID do remetente: ${msg.author || msg.from}`); // Aqui mostramos o ID da pessoa que enviou a mensagem

    // Comando !ping
    if (msg.body == '/ping') {
        msg.reply('Tô aqui seu Jaguará');
    }

    // Comando !lock - Apenas administradores podem usar
    if (msg.body == '/lock') {
        // Verifica se a mensagem foi enviada em um grupo
        if (msg.from.endsWith('@g.us')) {  // Verifica se é um grupo (IDs de grupos terminam com '@g.us')
            // Obtém o chat do grupo
            const chat = await msg.getChat();

            // Verifica se o chat é um grupo
            if (chat.isGroup) {
                // Obtém a lista de participantes do grupo
                const participants = chat.participants;

                // Inicializa isAdmin como falso
                let isAdmin = adminsList.includes(msg.from);  // Verifica se o ID do remetente está na lista de administradores
                
                // Caso o ID não esteja na lista de administradores, vamos buscar a lista de administradores no grupo
                if (!isAdmin) {
                    const adminInGroup = participants.some(participant => 
                        adminsList.includes(participant.id._serialized) && participant.isAdmin
                    );

                    if (adminInGroup) {
                        isAdmin = true;
                    }
                }

                if (isAdmin) {
                    // Altera a configuração do grupo para permitir somente administradores enviarem mensagens
                    await chat.setMessagesAdminsOnly(true);
                    msg.reply('Somente administradores podem agora enviar mensagens.');
                    console.log('Configuração alterada para permitir apenas administradores no grupo:', chat.id);
                } else {
                    msg.reply('Você não tem permissão para usar este comando. Apenas administradores podem.');
                }
            } else {
                msg.reply('Este comando só pode ser usado em grupos.');
            }
        } else {
            msg.reply('Este comando só pode ser usado em grupos.');
        }
    }

    // Comando !unlock - Permite que todos os membros do grupo enviem mensagens
    if (msg.body == '/unlock') {
        // Verifica se a mensagem foi enviada em um grupo
        if (msg.from.endsWith('@g.us')) {  // Verifica se é um grupo (IDs de grupos terminam com '@g.us')
            // Obtém o chat do grupo
            const chat = await msg.getChat();

            // Verifica se o chat é um grupo
            if (chat.isGroup) {
                // Inicializa isAdmin como falso
                let isAdmin = adminsList.includes(msg.author);  // Verifica se o ID do remetente está na lista de administradores
                
                if (!isAdmin) {
                    msg.reply('Você não tem permissão para usar este comando. Apenas administradores podem.');
                    return;
                }

                // Altera a configuração do grupo para permitir todos os membros enviarem mensagens
                await chat.setMessagesAdminsOnly(false);
                msg.reply('Agora todos os membros podem enviar mensagens no grupo.');
                console.log('Configuração alterada para permitir todos os membros no grupo:', chat.id);
            } else {
                msg.reply('Este comando só pode ser usado em grupos.');
            }
        } else {
            msg.reply('Este comando só pode ser usado em grupos.');
        }
    }

    // Comando !ban - Banir usuário
    if (msg.body.startsWith('/ban')) {
        const mentionedUsers = msg.mentionedUsers;
        if (mentionedUsers.length > 0) {
            const chat = await msg.getChat();
            await chat.removeParticipants([mentionedUsers[0]]);
            msg.reply('Usuário banido do grupo.');
            console.log(`Usuário ${mentionedUsers[0]} banido.`);
        } else if (msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            const quotedUser = quotedMsg.author;
            const chat = await msg.getChat();
            await chat.removeParticipants([quotedUser]);
            msg.reply('Usuário banido do grupo.');
            console.log(`Usuário ${quotedUser} banido.`);
        } else {
            msg.reply('Você precisa mencionar o usuário ou responder a uma mensagem para banir.');
        }
    }

    // Anti-links - Apaga mensagens com links e remove usuários que enviarem mais de 3 links
    if (!adminsList.includes(msg.author)) {  // Ignora verificações para administradores
        const urlRegex = /(https?:\/\/[^\s]+)/g; // Expressão regular para detectar URLs

        if (urlRegex.test(msg.body)) {  // Se a mensagem contiver um link
            // Apaga a mensagem para todos os participantes
            try {
                await msg.delete(true);  // Deleta a mensagem com link para todos
                msg.reply('Links não são permitidos neste grupo.');
                console.log(`Mensagem deletada de ${msg.author} por conter link.`);
            } catch (error) {
                console.log('Erro ao tentar deletar a mensagem:', error);
            }

            // Se o usuário ainda não estiver na contagem de tentativas
            if (!userLinkAttempts[msg.author]) {
                userLinkAttempts[msg.author] = 0;
            }

            // Incrementa a contagem de links enviados pelo usuário
            userLinkAttempts[msg.author]++;

            // Se o usuário enviar mais de 3 links
            if (userLinkAttempts[msg.author] > 3) {
                try {
                    // Remove o usuário do grupo
                    const chat = await msg.getChat();
                    await chat.removeParticipants([msg.author]);
                    msg.reply('Você foi removido do grupo por enviar muitos links.');
                    console.log(`Usuário ${msg.author} removido do grupo por enviar mais de 3 links.`);
                } catch (error) {
                    msg.reply('Houve um erro ao tentar remover o usuário.');
                    console.log('Erro ao remover o usuário:', error);
                }
            }
        }
    }

    // Comando /gostoso - Escolhe um usuário aleatório e menciona
    if (msg.body == '/gostoso') {
        if (msg.from.endsWith('@g.us')) {  // Verifica se é um grupo (IDs de grupos terminam com '@g.us')
            const chat = await msg.getChat();
            const participants = chat.participants;  // Inclui todos os participantes, sem filtrar administradores
            const randomUser = participants[Math.floor(Math.random() * participants.length)];  // Escolhe um participante aleatório
            const randomPercentage = Math.floor(Math.random() * 101);  // Gera uma porcentagem aleatória entre 0 e 100

            // Obtém o ID do participante para usar na menção
            const userId = randomUser.id._serialized;

            // Menciona o usuário aleatório com a sintaxe de menção do WhatsApp
            chat.sendMessage(`Boy @${randomUser.id.user} é ${randomPercentage}% gostoso uiiii quem ai será o mais gostoso do cabaré???`);

            console.log(`Mensagem de entretenimento enviada mencionando @${randomUser.id.user}.`);
        }
    }

    // Comando /corno - Escolhe um usuário aleatório e menciona
    if (msg.body == '/corno') {
        if (msg.from.endsWith('@g.us')) {  // Verifica se é um grupo (IDs de grupos terminam com '@g.us')
            const chat = await msg.getChat();
            const participants = chat.participants;  // Inclui todos os participantes
            const randomUser = participants[Math.floor(Math.random() * participants.length)];  // Escolhe um participante aleatório
            const randomPercentage = Math.floor(Math.random() * 101);  // Gera uma porcentagem aleatória entre 0 e 100

            // Obtém o ID do participante para usar na menção
            const userId = randomUser.id._serialized;

            // Menciona o usuário aleatório com a sintaxe de menção do WhatsApp e adiciona o "emote de vaca"
            chat.sendMessage(`Esse é @${randomUser.id.user} e ele é ${randomPercentage}% corno muuuu 🐄`);

            console.log(`Mensagem de entretenimento enviada mencionando @${randomUser.id.user}.`);
        }
    }



    // Comando /shipp - Junta dois usuários aleatórios e gera uma porcentagem
    if (msg.body == '/shipp') {
    if (msg.from.endsWith('@g.us')) {  // Verifica se é um grupo (IDs de grupos terminam com '@g.us')
        const chat = await msg.getChat();
        const participants = chat.participants;  // Inclui todos os participantes
        const randomUser1 = participants[Math.floor(Math.random() * participants.length)];  // Escolhe o primeiro participante aleatório
        const randomUser2 = participants[Math.floor(Math.random() * participants.length)];  // Escolhe o segundo participante aleatório

        // Evita escolher a mesma pessoa para ambos os participantes
        if (randomUser1.id._serialized === randomUser2.id._serialized) {
            return msg.reply('Os dois participantes não podem ser a mesma pessoa! Tentando novamente...');
        }

        const randomPercentage = Math.floor(Math.random() * 101);  // Gera uma porcentagem aleatória entre 0 e 100

        // Envia a mensagem mencionando ambos os participantes e a porcentagem
        chat.sendMessage(`O @${randomUser1.id.user} e o @${randomUser2.id.user} formam um belo casal com ${randomPercentage}% de compatibilidade! ❤️`);

        console.log(`Mensagem de shipp enviada mencionando @${randomUser1.id.user} e @${randomUser2.id.user}.`);
        }
    }

});


// Comando /menu - Exibe a lista de comandos disponíveis
client.on('message', async (msg) => {
    if (msg.body == '/menu') {
        const isAdmin = adminsList.includes(msg.author);  // Verifica se o remetente está na lista de administradores

        let menuMessage = '🎉 **Comandos disponíveis** 🎉\n\n';

        if (isAdmin) {
            // Se for admin, exibe todos os comandos com emojis e negrito
            menuMessage += '🔒 **/lock** - Bloqueia o envio de mensagens no grupo para admins.\n';
            menuMessage += '🔓 **/unlock** - Desbloqueia o envio de mensagens no grupo para todos.\n';
            menuMessage += '🚫 **/ban @usuario** - Banir um usuário do grupo.\n';
            menuMessage += '💋 **/gostoso** - Marcar alguém aleatório como gostoso.\n';
            menuMessage += '👑 **/corno** - Marcar alguém aleatório como corno.\n';
            menuMessage += '💑 **/shipp** - Encontre um casal aleatório.\n';
            menuMessage += '📲 **/all** - Marca todos os participantes no grupo.\n';
            menuMessage += '🤳 **/fig** - Cria uma figurinha ao responder uma foto.\n';
            menuMessage += '📜 **/regras** - Lista as regras do grupo.\n';
        } else {
            // Se não for admin, exibe apenas os comandos públicos
            menuMessage += '💋 **/gostoso** - Marcar alguém aleatório como gostoso.\n';
            menuMessage += '👑 **/corno** - Marcar alguém aleatório como corno.\n';
            menuMessage += '💑 **/shipp** - Encontre um casal aleatório.\n';
            menuMessage += '📲 **/menu** - Exibe esta lista de comandos.\n';
            menuMessage += '🤳 **/fig** - Cria uma figurinha ao responder uma foto.\n';
            menuMessage += '📜 **/regras** - Lista as regras do grupo.\n';
        }

        // Envia a mensagem com formatação mais bonita
        msg.reply(menuMessage);
    }
});



client.on('message', async (msg) => {
    // Verifica se a mensagem é uma resposta e se a mensagem original contém mídia
    if (msg.body === '/fig' && msg.hasQuotedMsg) {
        const quotedMsg = await msg.getQuotedMessage();  // Obtém a mensagem original citada

        // Verifica se a mensagem original é uma mídia (foto, vídeo, etc.)
        if (quotedMsg.hasMedia) {
            const media = await quotedMsg.downloadMedia();  // Baixa a mídia da mensagem citada

            // Envia a mídia como sticker
            client.sendMessage(msg.from, media, { sendMediaAsSticker: true });

           
        } else {
            // Caso a mensagem citada não seja uma foto ou mídia
            msg.reply('Por favor, responda a uma foto com o comando /fig.');
        }
    }
});


// Evento para detectar quando alguém entra no grupo
client.on('group_participants', async (notification) => {
    // Verifica se a ação foi "entrando" no grupo
    if (notification.action === 'add') {
        const groupId = notification.chat.id;
        const newParticipant = notification.participants[0];

        // Mensagem de boas-vindas detalhada
        const welcomeMessage = `🎉 Bem-vindo(a) ao grupo, @${newParticipant}!\n\n` +
            "ENTROU, SE APRESENTA 📸\n\n" +
            "Foto:\n" +
            "Nome:\n" +
            "Idade:\n" +
            "Cidade:\n\n" +
            "Use /menu para ver a lista de comandos\n" +
            "Se divirta! 😎";

        // Envia a mensagem de boas-vindas com a menção ao novo membro
        await client.sendMessage(groupId, welcomeMessage, { mentions: [newParticipant] });
    }
});

client.on('message', async (msg) => {
    // Comando /regras para enviar as regras do grupo
    if (msg.body === '/regras') {
        const regras = `🚫 PROIBIDO 🚫 

Ir no PV dos ADMS sem permissão 🤙🏻

Racismo 

Homofobia 

Gordofobia

E qualquer tipo de preconceito 

Discussão politica

Apenas 14 anos +

Proibido Ameaças

Proibido apologia ao nazismo/racismo

Proibido qualquer tipo de intolerância seja religiosa ou não.

Idade máxima 35 anos 

Proibido nudes 

| Se divertir

Proibido divulgar links e etc...

* REGRAS DO GRUPO 
* ⁠respeita os adms 
* ⁠respeita o próximo 
* ⁠respeita as regras
* ⁠se apresentar 
* ⁠e se divertir`;

        // Envia as regras no grupo
        await msg.reply(regras);
    }
});

// Quando alguém entra no grupo, envia a mensagem de boas-vindas
client.on('group_join', async (notification) => {
    // Obtém informações sobre o grupo e o usuário que entrou
    const chat = await notification.getChat();
    const newMember = notification.participants[0];  // O ID do novo membro

    // Mensagem de boas-vindas
    const welcomeMessage = `🎉 **Bem-vindo(a), ${newMember.split('@')[0]}!** 🎉\n\n` +
        'Seja muito bem-vindo(a) ao nosso grupo! 😄\n\n' +
        'ENTROU SE APRESENTA 📸\n\n' +
        '**Foto:**\n' +
        '**Nome:**\n' +
        '**Idade:**\n' +
        '**Cidade:**\n\n' +
        'Para saber mais sobre o grupo, use **/menu** para ver todos os comandos disponíveis!\n\n' +
        'Estamos felizes em ter você aqui, aproveite! 🎊\n\n' +
        'Lembre-se de seguir as **regras do grupo** para garantir que todos se divirtam juntos! 👌';

    // Envia a mensagem de boas-vindas no grupo
    await chat.sendMessage(welcomeMessage);
});


client.on('message', async (message) => {
    if (message.body === '/all') { // Comando para mencionar todos
        // Verifica se o remetente está na lista de administradores
        if (!adminsList.includes(message.author)) {
            message.reply('❌ Você não tem permissão para usar este comando.');
            return;
        }

        const chat = await message.getChat();

        if (chat.isGroup) {
            const mentions = [];
            let text = '👋 Olá, @todos!';

            // Coleta todos os participantes do grupo
            for (let participant of chat.participants) {
                const contact = await client.getContactById(participant.id._serialized);
                mentions.push(contact); // Adiciona na lista de menções
                text += `\n@${contact.number}`; // Adiciona o número à mensagem
            }

            // Envia a mensagem com menções
            chat.sendMessage(text, { mentions });
        } else {
            message.reply('Este comando só pode ser usado em grupos!');
        }
    }
});




client.initialize();


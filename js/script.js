// Model
class Game {
    constructor(options) {
        let {sizeX, sizeY, gameContainerID, notificationID, scoreID} = options;

        this.sizeX = sizeX;
        this.sizeY = sizeY || sizeX;

        this.gameContainerID = gameContainerID;
        this.notificationID = notificationID;

        this.score = document.getElementById(scoreID);

        this.render = new RenderWhackCube({gameContainerID: this.gameContainerID, sizeX: this.sizeX, sizeY: this.sizeY});
        this.control =new ControlWhackCube({containerID: gameContainerID});

        this.status = 'stop';

        this.control.setCallback(this.controlCallback.bind(this));
    }

    load() {
        this.render.setupNotifications({containerID: this.notificationID, timeOut: 5000, test: true});
        this.render.startShow();

        this.loaded = true;
    }

    start(options = {}) {
        let {timer} = options;

        this.ttl = timer || 500;
        this.blocksCache = [];
        this.successfulBlocks = [];
        this.failedlBlocks = [];
        this.currentBlock = {};
        this.status = 'run';

        if ( !this.loaded ) {
            this.load();
        } else {
            this.render.debug('Game in restarted. Options: ttl - ' + this.ttl)
        }

        this.calculateScore();

        this.render.reset();

        clearInterval(this.process);

        this.eventLoop();
        this.process = setInterval(this.eventLoop.bind(this), this.ttl);
    }

    pause() {
        this.render.sendNotification({type: 'info', message: 'Game in paused'});
        clearInterval(this.process);
        this.status = 'pause';
    }

    resume() {
        this.render.sendNotification({type: 'info', message: 'Game in continued'});
        this.eventLoop();
        this.process = setInterval(this.eventLoop.bind(this), this.ttl);
        this.status = 'run';
    }

    eventLoop() {
        let lastCoordinates = this.currentBlock.coordinates;
        let newCoordinates = this.getNewCoordinates();

        this.blocksCache = this.blocksCache.slice(-4);

        if (newCoordinates) {
            this.render.setActiveCube(newCoordinates, 'black');
            this.currentBlock = {coordinates: newCoordinates, type: 'active'};

            if ( lastCoordinates) {
                this.controlCallback(lastCoordinates);
            }
        }
        else {
            clearInterval(this.process);
            this.render.debug({type: 'error', message: 'Game can`t be continued!'})
        }
    }

    isGameEnd() {
        return [...this.successfulBlocks, ...this.failedlBlocks].length >= ( this.sizeX * this.sizeY / 2);
    }

    calculateScore() {
        let successful= this.successfulBlocks.length ;
        let failed = this.failedlBlocks.length;

        if (this.score) {
            this.score.innerText = `${successful}:${failed}`
        }

        return { successful, failed }
    }

    controlCallback(coordinates) {
        let hash = this.getHash(coordinates);

        if (this.status === 'run') {
            if ( hash === this.getHash(this.currentBlock.coordinates) ) {
                this.render.setActiveCube(coordinates, 'green');
                this.successfulBlocks.push(this.getHash(coordinates));
                this.currentBlock.type = 'successful';
            }
            else if ( ![...this.successfulBlocks, ...this.failedlBlocks].includes(hash)) {
                this.render.setActiveCube(coordinates, 'red');
                this.failedlBlocks.push(this.getHash(coordinates));
            }

            if (this.isGameEnd()) {
                clearInterval(this.process);

                let {successful, failed} = this.calculateScore();

                if (successful > failed) {
                    this.render.sendNotification({type: 'good', message: `You are winner!`});
                } else {
                    this.render.sendNotification({type: 'failed', message: `Terminator T-800 was better.`});
                }

                this.status = 'stop';
            }

            this.calculateScore();
        }
    }

    getHash({x, y}) {
        return x + ':' + y;
    }

    getNewCoordinates(recursiveIndex) {
        let coordinates = this.generateRandomCoordinates();
        let hash = this.getHash(coordinates);

        if ( !recursiveIndex ) recursiveIndex = 1;

        if ( ![...this.blocksCache, ...this.successfulBlocks, ...this.failedlBlocks].includes(hash)) {
            this.blocksCache.push(hash);

            return coordinates;
        } else if (recursiveIndex < 200 ){
            return this.getNewCoordinates(++recursiveIndex);
        } else {
            this.render.debug({type: 'warning', message: 'I can`t find free blocks!'});
            return 0;
        }
    }

    generateRandomCoordinates() {
        let x = 1 + Math.floor(Math.random() * (this.sizeX));
        let y = 1 + Math.floor(Math.random() * (this.sizeY));

        return {x, y};
    }
}

class RenderWhackCube {
    constructor(options) {
        let {gameContainerID, sizeX, sizeY} = options;

        this.gameContainer = document.getElementById(gameContainerID);
        this.sizeX = sizeX;
        this.sizeY = sizeY || sizeX;

        this.tableClass = 'game__area';
        this.datumClass = 'area__block';
    }

    reset() {
        this.table.querySelectorAll('td').forEach( element => {
            element.style.background = '';
        })
    }
    
    startShow() {
        if ( !this.table ) {
            this.createTable();
            if ( this.DEBAG &&  this.notificationContainer !== null ) {
                this.debug('Table is successful created');
            }
        }
    }

    createTable() {
        this.table = document.createElement('table');

        this.table.classList.add(this.tableClass);
        this.gameContainer.append(this.table);

        for (let rowIndex = 1; rowIndex <= this.sizeY; rowIndex++) {
            let row = document.createElement('tr');
            row.setAttribute('data-index', rowIndex.toString());

            for(let datumIndex = 1; datumIndex <= this.sizeX; datumIndex++) {
                let datum = document.createElement('td');
                datum.setAttribute('data-index', datumIndex.toString());

                datum.classList.add(this.datumClass);

                row.append(datum);
            }

            this.table.append(row);
        }

        return this.table;
    }

    setActiveCube({x,y}, color) {
        let cube = this.getCubeByCoordinates({x,y});
        if (cube) {
            cube.style.background = color;
        }
    }

    removeActiveCube({x,y}) {
        let cube = this.getCubeByCoordinates({x,y});
        if (cube) {
            cube.style.background = '';
        }
    }

    getCubeByCoordinates({x,y}) {
        let cube = this.table.querySelector(`tr:nth-child(${y}) td:nth-child(${x})`);

        if (!cube) {
            this.debug({type: 'error', message: `Datum not found. Some error happened! [x: ${x}, y: ${y}]`})
        }
        return cube;
    }

    setupNotifications(options) {
        let {containerID, timeOut, test} = options;
        this.notificationContainer = document.getElementById(containerID);
        this.notificationTimeOut = timeOut;
        this.DEBAG = test;

        if(this.notificationContainer === null) {
            console.error('Container is not founded! Check you settings.')
        } else if (this.DEBAG) {
            this.sendNotification({type: 'log', message: 'Notifications was setup successful'})
        }
    }

    sendNotification(data) {
        let {type, message} = data;

        if(this.notificationContainer === null) {
            console.error('Container not selected! Set container before.')
        } else try {
            let singleNotification = document.createElement('div');
            let notificationTitle = document.createElement('h4');
            let notificationMessage = document.createElement('p');

            singleNotification.className += 'alert alert-' + type;
            notificationTitle.innerText = type.toUpperCase();
            notificationMessage.innerText = message;
            singleNotification.append(notificationTitle, notificationMessage);

            this.notificationContainer.prepend(singleNotification);


            setTimeout( () => {
                singleNotification.classList.add('disable');
                setTimeout(() => {
                    singleNotification.remove();
                }, 1000)
            } , this.notificationTimeOut)
        } catch {
            console.error('Some error happened!');
        }
    }

    debug (data) {
        let type = data.type || 'log';
        let message = data.message || data || 'Debug';

        if (this.DEBAG && this.notificationContainer !== null) {
            this.sendNotification({type, message});
        }
    }
}

class ControlWhackCube {
    constructor(options) {
        let {containerID} = options;

        this.container = document.getElementById(containerID);
        this.container.addEventListener( 'click', this.clickEvent.bind(this));
    }

    getTableCoordinates(datum) {
        let x = datum.cellIndex + 1;
        let y = datum.parentElement.rowIndex + 1;

        return {x, y};
    }

    setCallback(callback) {
        this.callback = callback;
    }

    clickEvent(event) {
        if(event.target.closest('table') && event.target.localName === 'td') {
            let coordinates = this.getTableCoordinates(event.target);

            if(this.callback) {
                this.callback(coordinates);
            }
        }
    }
}

let gameOptions = {
    sizeX: 10,
    gameContainerID: 'game__area',
    notificationID: 'notifications',
    scoreID: 'score__value',
};
let game = new Game(gameOptions);

let buttons = document.getElementById('game__controls');
let gameControl = document.getElementById('processControl');

buttons.addEventListener('click', (event)=> {
    let timer = event.target.getAttribute('data-ttl');

    if (timer) {
        game.start({timer});
        gameControl.classList.add('active');
    }

});

gameControl.addEventListener('click' , () => {
    if (game.status === 'stop') {
        event.target.innerText = 'Stop';
        game.start();
     } else if (game.status === 'run') {
        event.target.innerText = 'Resume';
        game.pause();
    } else if (game.status === 'pause') {
        event.target.innerText = 'Pause';
        game.resume();
    }

});
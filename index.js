(function() {

const authToken = '<auth-token-here>';

const fetchJsonWithAuth = (url, options={}) => fetch(`https://app.asana.com/api/1.0${url}`, {
  ...options,
  headers:  {
   ...options.headers,
    Authorization: `Bearer ${authToken}`,
  }
}).then(res => res.json())
  .then(res => res.data);


const getSections = () => fetchJsonWithAuth(`/projects/${window.location.href.split('/')[4]}/sections`);

const getTasks = (section) =>  fetchJsonWithAuth(`/sections/${section}/tasks`);

const getStories = ({id}) => fetchJsonWithAuth(`/tasks/${id}/stories`);


const groupSectionsByName = (sections) => sections.reduce((acc, {name, id}) => ({...acc, [name.toLowerCase()]: id}) , {})

const getRelevantSection = (sections) => new Promise((res, rej) => {
  const boardName = prompt('Enter section name').toLowerCase();

  res({id: sections[boardName], label: boardName});
});

const getDayThreshold = () => new Promise((res, rej) => {
  res(prompt('Enter threshold days'));
});

const normalizeStories = (story, i, arr) => {
  if(story.type === 'added') {
    story.from = null;
    if(arr[i+1]) {
      story.to = arr[i+1].type==='moved' ? arr[i+1].from : 'unknown';
    } else {
      story.to = sectionName;
    }
  }
  else if(story.type === 'removed') {
    story.to = null;
    if(arr[i-1].type === 'added') {
      story.from = 'unknown';
    } else {
      story.from = arr[i-1].to;
    }
  }
  return story;
}

const getRelevantStories = (projectName, sectionName) => (stories) =>  stories
  .filter(({type}) =>type === 'system')
  .reduce((acc, story) => {
    if(story.text === `added to ${projectName}`) {
      return acc.concat({type: 'added', date: story.created_at});
    }
    if(story.text === `removed from ${projectName}`) {
      return acc.concat({type: 'removed', date: story.created_at});
    }
    if(story.text.startsWith('moved this Task from')) {
      const match = /^moved this Task from (.+) to (.+?)(?:(?: in )(.*))?$/.exec(story.text);
      if(!match) {
        return acc;
      }
      const [_, from, to, project] = match;
      if(project === projectName || !project) {
        return acc.concat({type: 'moved', date: story.created_at, from, to});
      }
    }
    return acc;
  }, [])
  .map(normalizeStories)
  .reverse()
  .find(story => story.to.toLowerCase() === sectionName);

const dataDisplayStyle = {fontSize: '11px', display: 'inline-flex', alignItems: 'flex-end', marginLeft: '0.3em', color: '#000'};

const addDaysAndMarkOldCards =  (sectionName, dayThreshold, tasks) => {
  console.log('here');
  const sectionBoards = document.querySelectorAll('.BoardColumn.BoardBody-column.BoardBody-columnInBoardWithViewMenu');
  const sectionBoard = [...sectionBoards].find(x => x.querySelector('.BoardColumnHeaderTitle').innerText.toLowerCase() === sectionName);
  const taskCards = sectionBoard.querySelectorAll('.BoardCardWithCustomProperties.BoardColumnCardsContainer-item');
  [...taskCards]
    .map((x) => {
      const task = tasks.find((task) => task.name === x.querySelector('.BoardCardWithCustomProperties-name').innerText);
      return {task, card: x};
    })
    .filter(x => x.task)
    .forEach(markCard(dayThreshold));
}

const markCard = (dayThreshold) => ({card, task}) => {
  if(task.days >= dayThreshold) {
    card.style.backgroundColor = 'red';
  }
  const daysDisplay = document.createElement('div');
  daysDisplay.innerText = task.days > 0 ? `${task.days} days` : 'today';
  daysDisplay.classList.add('days-display');
  Object.keys(dataDisplayStyle).forEach((key) => daysDisplay.style[key] = dataDisplayStyle[key]);
  if(!card.querySelector('.days-display')) {
    card.querySelector('.BoardCardWithCustomProperties-metadata').appendChild(daysDisplay);
  }
}

const setTaskDays = (tasks) => (stories) => stories.map((s, i) => ({...tasks[i], days: Math.floor((new Date() - new Date(s.date)) / (1000 * 3600 * 24)) }))


const getStoriesForTasks = (projectName, sectionName) => (tasks) => Promise.all(tasks.map(getStories))
.then((stories) => stories.map(getRelevantStories(projectName, sectionName)))
.then(setTaskDays(tasks))
.then((tasksWithDays) => getDayThreshold()
    .then((days) => addDaysAndMarkOldCards(sectionName, days, tasksWithDays))
)

const getTasksForSection = (projectName) => ({label: sectionName, id}) => getTasks(id)
  .then(getStoriesForTasks(projectName, sectionName))


fetchJsonWithAuth(`/projects/${window.location.href.split('/')[4]}`)
  .then(({name: projectName}) => getSections()
      .then(groupSectionsByName)
      .then(getRelevantSection)
      .then(getTasksForSection(projectName))
 );
})();

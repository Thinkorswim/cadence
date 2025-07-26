export class ProjectUtils {
  static addProject(projects: string[], name: string): string[] {
    if (!projects.includes(name)) {
      return [...projects, name];
    }
    return projects;
  }

  static removeProject(projects: string[], selectedProject: string, projectName: string): { 
    projects: string[], 
    selectedProject: string 
  } {
    if (projectName === 'General') {
      return { projects, selectedProject }; // Cannot remove the default project
    }
    
    const newProjects = projects.filter(p => p !== projectName);
    const newSelectedProject = selectedProject === projectName ? 'General' : selectedProject;
    
    return { 
      projects: newProjects, 
      selectedProject: newSelectedProject 
    };
  }

  static getProject(projects: string[], projectName: string): string | undefined {
    return projects.find(p => p === projectName);
  }

  static getSelectedProject(projects: string[], selectedProject: string): string {
    return ProjectUtils.getProject(projects, selectedProject) ?? projects[0] ?? 'General';
  }

  static selectProject(projects: string[], projectName: string): string | null {
    if (projects.includes(projectName)) {
      return projectName;
    }
    return null;
  }

  static isValidProject(projects: string[], projectName: string): boolean {
    return projects.includes(projectName);
  }
}
